/* src/input/handler.js - Input event capture and processing */

const { GObject, Clutter, Gdk, GLib } = imports.gi;
const Main = imports.ui.main;

/**
 * Input event handler for touch, mouse, and stylus input.
 * Normalizes events across X11 and Wayland, provides debouncing,
 * and feeds into gesture recognition pipeline.
 */
const InputEventHandler = GObject.registerClass(
class InputEventHandler extends GObject.Object {
    _init(keyboardUI, settingsManager) {
        super._init();

        this._keyboardUI = keyboardUI;
        this._settings = settingsManager;
        this._stage = global.stage;

        // State tracking
        this._activeTouches = new Map(); // touchId -> { x, y, pressure, startTime }
        this._mouseDown = false;
        this._mousePosition = { x: 0, y: 0 };
        this._stylusDown = false;
        this._stylusPressure = 0;
        this._lastEventTime = 0;
        this._debounceThreshold = 16; // ms, ~60fps

        // Gesture recognition pipeline
        this._gestureRecognizer = null; // will be set later

        // Event listeners
        this._stageListenerIds = [];
        this._keyboardListenerIds = [];

        // Platform detection
        this._isWayland = GLib.getenv('WAYLAND_DISPLAY') !== null;

        log('[BetterKeys] InputEventHandler initialized');
    }

    /**
     * Start capturing input events.
     */
    start() {
        log('[BetterKeys] Starting input event capture');

        // Connect to stage events for global input
        this._connectStageEvents();

        // Connect to keyboard UI events for focused input
        this._connectKeyboardEvents();

        // Initialize gesture recognizer if available
        if (this._gestureRecognizer) {
            this._gestureRecognizer.start();
        }
    }

    /**
     * Stop capturing input events and clean up.
     */
    stop() {
        log('[BetterKeys] Stopping input event capture');

        // Disconnect stage events
        this._stageListenerIds.forEach(id => {
            this._stage.disconnect(id);
        });
        this._stageListenerIds = [];

        // Disconnect keyboard events
        this._keyboardListenerIds.forEach(id => {
            if (this._keyboardUI) {
                this._keyboardUI.disconnect(id);
            }
        });
        this._keyboardListenerIds = [];

        // Stop gesture recognizer
        if (this._gestureRecognizer) {
            this._gestureRecognizer.stop();
        }

        // Clear state
        this._activeTouches.clear();
        this._mouseDown = false;
        this._stylusDown = false;
    }

    /**
     * Connect to global stage events (touch, mouse, stylus).
     */
    _connectStageEvents() {
        // Touch events
        if (this._isWayland) {
            // Wayland touch events via Clutter
            const touchId = this._stage.connect('touch-event', this._onTouchEvent.bind(this));
            this._stageListenerIds.push(touchId);
        } else {
            // X11 touch events (if supported)
            const touchId = this._stage.connect('touch-event', this._onTouchEvent.bind(this));
            this._stageListenerIds.push(touchId);
        }

        // Mouse events
        const mousePressId = this._stage.connect('button-press-event', this._onMousePress.bind(this));
        const mouseReleaseId = this._stage.connect('button-release-event', this._onMouseRelease.bind(this));
        const mouseMoveId = this._stage.connect('motion-event', this._onMouseMove.bind(this));
        this._stageListenerIds.push(mousePressId, mouseReleaseId, mouseMoveId);

        // Stylus events (if supported)
        const stylusId = this._stage.connect('pad-button-press-event', this._onStylusEvent.bind(this));
        this._stageListenerIds.push(stylusId);

        log('[BetterKeys] Stage event listeners connected');
    }

    /**
     * Connect to keyboard UI specific events.
     */
    _connectKeyboardEvents() {
        if (!this._keyboardUI) {
            return;
        }

        // Keyboard UI may have its own event handling for keys
        // We'll also listen for enter/leave events for hover effects
        const enterId = this._keyboardUI.connect('enter-event', this._onKeyboardEnter.bind(this));
        const leaveId = this._keyboardUI.connect('leave-event', this._onKeyboardLeave.bind(this));
        this._keyboardListenerIds.push(enterId, leaveId);
    }

    /**
     * Set the gesture recognizer instance.
     * @param {GestureRecognizer} recognizer - The gesture recognizer to use.
     */
    setGestureRecognizer(recognizer) {
        this._gestureRecognizer = recognizer;
    }

    /**
     * Handle touch events (multi-touch).
     * @param {Clutter.Actor} actor - The actor that received the event.
     * @param {Clutter.Event} event - The touch event.
     * @returns {Clutter.EventPropagation} Whether to propagate the event.
     */
    _onTouchEvent(actor, event) {
        const eventType = event.type();
        const touchId = event.get_touch_id();
        const [x, y] = event.get_coords();
        const pressure = event.get_pointer_axis(Clutter.Axis.PRESSURE) || 0.5;
        const time = event.get_time();

        // Debounce check
        if (!this._shouldProcessEvent(time)) {
            return Clutter.EVENT_PROPAGATE;
        }

        switch (eventType) {
            case Clutter.EventType.TOUCH_BEGIN:
                this._activeTouches.set(touchId, {
                    x, y, pressure,
                    startTime: time,
                    startX: x,
                    startY: y
                });
                this.emit('touch-start', { touchId, x, y, pressure });
                break;
            case Clutter.EventType.TOUCH_UPDATE:
                const touch = this._activeTouches.get(touchId);
                if (touch) {
                    touch.x = x;
                    touch.y = y;
                    touch.pressure = pressure;
                    this.emit('touch-update', { touchId, x, y, pressure });
                }
                break;
            case Clutter.EventType.TOUCH_END:
            case Clutter.EventType.TOUCH_CANCEL:
                this._activeTouches.delete(touchId);
                this.emit('touch-end', { touchId, x, y, pressure });
                break;
        }

        // Forward to gesture recognizer if available
        if (this._gestureRecognizer) {
            this._gestureRecognizer.processTouchEvent(eventType, touchId, x, y, pressure);
        }

        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Handle mouse press events.
     */
    _onMousePress(actor, event) {
        const button = event.get_button();
        const [x, y] = event.get_coords();
        const time = event.get_time();

        if (!this._shouldProcessEvent(time)) {
            return Clutter.EVENT_PROPAGATE;
        }

        this._mouseDown = true;
        this._mousePosition = { x, y };

        this.emit('mouse-down', { button, x, y });

        // If over keyboard UI, treat as touch for key presses
        if (this._isOverKeyboard(x, y)) {
            this._keyboardUI._onKeyPressed(null, this._getKeyAtPosition(x, y));
        }

        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Handle mouse release events.
     */
    _onMouseRelease(actor, event) {
        const button = event.get_button();
        const [x, y] = event.get_coords();
        const time = event.get_time();

        if (!this._shouldProcessEvent(time)) {
            return Clutter.EVENT_PROPAGATE;
        }

        this._mouseDown = false;

        this.emit('mouse-up', { button, x, y });

        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Handle mouse motion events.
     */
    _onMouseMove(actor, event) {
        const [x, y] = event.get_coords();
        const time = event.get_time();

        if (!this._shouldProcessEvent(time)) {
            return Clutter.EVENT_PROPAGATE;
        }

        this._mousePosition = { x, y };

        this.emit('mouse-move', { x, y });

        // Hover effects
        if (this._isOverKeyboard(x, y)) {
            this.emit('keyboard-hover', { x, y });
        }

        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Handle stylus events (pressure-sensitive).
     */
    _onStylusEvent(actor, event) {
        const eventType = event.type();
        const [x, y] = event.get_coords();
        const pressure = event.get_pointer_axis(Clutter.Axis.PRESSURE) || 0;
        const time = event.get_time();

        if (!this._shouldProcessEvent(time)) {
            return Clutter.EVENT_PROPAGATE;
        }

        switch (eventType) {
            case Clutter.EventType.PAD_BUTTON_PRESS:
                this._stylusDown = true;
                this._stylusPressure = pressure;
                this.emit('stylus-down', { x, y, pressure });
                break;
            case Clutter.EventType.PAD_BUTTON_RELEASE:
                this._stylusDown = false;
                this.emit('stylus-up', { x, y, pressure });
                break;
            case Clutter.EventType.PAD_MOTION:
                this._stylusPressure = pressure;
                this.emit('stylus-move', { x, y, pressure });
                break;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Handle keyboard UI enter events.
     */
    _onKeyboardEnter(actor, event) {
        this.emit('keyboard-focused', true);
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Handle keyboard UI leave events.
     */
    _onKeyboardLeave(actor, event) {
        this.emit('keyboard-focused', false);
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Check if an event should be processed based on debounce threshold.
     * @param {number} eventTime - Timestamp of the event.
     * @returns {boolean} True if the event should be processed.
     */
    _shouldProcessEvent(eventTime) {
        const delta = eventTime - this._lastEventTime;
        if (delta < this._debounceThreshold) {
            return false;
        }
        this._lastEventTime = eventTime;
        return true;
    }

    /**
     * Check if coordinates are over the keyboard UI.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @returns {boolean} True if over keyboard.
     */
    _isOverKeyboard(x, y) {
        if (!this._keyboardUI || !this._keyboardUI.isVisible()) {
            return false;
        }

        const [keyboardX, keyboardY] = this._keyboardUI.get_position();
        const keyboardWidth = this._keyboardUI.width;
        const keyboardHeight = this._keyboardUI.height;

        return x >= keyboardX && x <= keyboardX + keyboardWidth &&
               y >= keyboardY && y <= keyboardY + keyboardHeight;
    }

    /**
     * Determine which key is at the given position (if any).
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @returns {string|null} Key label or null.
     */
    _getKeyAtPosition(x, y) {
        // This is a simplified implementation; the real implementation
        // would need to iterate through keys and check bounds.
        // For now, return null and let the keyboard UI handle it.
        return null;
    }

    /**
     * Get current active touches.
     * @returns {Map} Map of active touches.
     */
    getActiveTouches() {
        return new Map(this._activeTouches);
    }

    /**
     * Get mouse state.
     * @returns {Object} Mouse state.
     */
    getMouseState() {
        return {
            down: this._mouseDown,
            x: this._mousePosition.x,
            y: this._mousePosition.y
        };
    }

    /**
     * Get stylus state.
     * @returns {Object} Stylus state.
     */
    getStylusState() {
        return {
            down: this._stylusDown,
            pressure: this._stylusPressure
        };
    }

    /**
     * Set debounce threshold in milliseconds.
     * @param {number} threshold - New threshold.
     */
    setDebounceThreshold(threshold) {
        this._debounceThreshold = threshold;
    }
});

// Add signals to the class
InputEventHandler.signals = {
    'touch-start': { param_types: [GObject.TYPE_POINTER] },
    'touch-update': { param_types: [GObject.TYPE_POINTER] },
    'touch-end': { param_types: [GObject.TYPE_POINTER] },
    'mouse-down': { param_types: [GObject.TYPE_POINTER] },
    'mouse-up': { param_types: [GObject.TYPE_POINTER] },
    'mouse-move': { param_types: [GObject.TYPE_POINTER] },
    'stylus-down': { param_types: [GObject.TYPE_POINTER] },
    'stylus-up': { param_types: [GObject.TYPE_POINTER] },
    'stylus-move': { param_types: [GObject.TYPE_POINTER] },
    'keyboard-focused': { param_types: [GObject.TYPE_BOOLEAN] },
    'keyboard-hover': { param_types: [GObject.TYPE_POINTER] }
};

// Export the InputEventHandler class
var InputEventHandler = InputEventHandler;
