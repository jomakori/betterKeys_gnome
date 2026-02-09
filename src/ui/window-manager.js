/* src/ui/window-manager.js - Keyboard window management */

const { GObject, St, Clutter } = imports.gi;

var betterKeysWindowManager = GObject.registerClass(
class betterKeysWindowManager extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._keyboardUI = null;
        this._window = null;
        this._isVisible = false;
        this._dockingPosition = 'bottom'; // 'top', 'bottom', 'left', 'right', 'floating'
        this._floatingPosition = { x: 0, y: 0 };
        this._monitorIndex = 0;
        this._monitorGeometry = null;
        this._constraints = { minWidth: 200, minHeight: 100, maxWidth: 2000, maxHeight: 1000 };
        this._resizeHandle = null;
        this._isResizing = false;
        this._resizeStart = { x: 0, y: 0, width: 0, height: 0 };
        this._animationDuration = 200;

        // Track active monitor
        this._updateMonitorGeometry();

        // Connect to monitor changes
        global.display.connect('monitors-changed', this._onMonitorsChanged.bind(this));
        global.display.connect('workareas-changed', this._onWorkareasChanged.bind(this));

        log('[betterKeys] WindowManager initialized');
    }

    /**
     * Set the keyboard UI instance to manage.
     * @param {KeyboardUI} keyboardUI - The keyboard UI widget.
     */
    setKeyboardUI(keyboardUI) {
        if (this._keyboardUI === keyboardUI) return;

        if (this._keyboardUI) {
            this._keyboardUI.destroy();
        }

        this._keyboardUI = keyboardUI;

        // Create a window container for the keyboard
        this._createWindow();

        // Apply current docking position
        this.setDockingPosition(this._dockingPosition);

        log('[betterKeys] KeyboardUI attached to WindowManager');
    }

    _createWindow() {
        // Create a container window (St.Widget) that holds the keyboard
        this._window = new St.Widget({
            reactive: true,
            can_focus: true,
            style_class: 'betterkeys-window',
            x: 0,
            y: 0,
            width: 800,
            height: 300
        });

        // Add keyboard UI as child
        if (this._keyboardUI) {
            this._window.add_child(this._keyboardUI);
        }

        // Create resize handle (only for floating mode)
        this._createResizeHandle();

        // Connect window events
        this._window.connect('button-press-event', this._onWindowButtonPress.bind(this));
        this._window.connect('button-release-event', this._onWindowButtonRelease.bind(this));
        this._window.connect('motion-event', this._onWindowMotion.bind(this));

        // Initially hidden
        this._window.hide();
    }

    _createResizeHandle() {
        this._resizeHandle = new St.Widget({
            reactive: true,
            can_focus: false,
            style_class: 'betterkeys-resize-handle',
            width: 20,
            height: 20,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END
        });

        this._resizeHandle.connect('button-press-event', this._onResizeStart.bind(this));
        this._resizeHandle.connect('button-release-event', this._onResizeEnd.bind(this));
        this._resizeHandle.connect('motion-event', this._onResizeMove.bind(this));

        this._window.add_child(this._resizeHandle);
        this._resizeHandle.hide();
    }

    _onResizeStart(actor, event) {
        if (this._dockingPosition !== 'floating') return Clutter.EVENT_PROPAGATE;

        this._isResizing = true;
        [this._resizeStart.x, this._resizeStart.y] = event.get_coords();
        this._resizeStart.width = this._window.width;
        this._resizeStart.height = this._window.height;

        this._window.add_style_class_name('betterkeys-window-resizing');
        return Clutter.EVENT_STOP;
    }

    _onResizeMove(actor, event) {
        if (!this._isResizing) return Clutter.EVENT_PROPAGATE;

        let [x, y] = event.get_coords();
        let deltaX = x - this._resizeStart.x;
        let deltaY = y - this._resizeStart.y;

        let newWidth = Math.max(
            this._constraints.minWidth,
            Math.min(this._constraints.maxWidth, this._resizeStart.width + deltaX)
        );
        let newHeight = Math.max(
            this._constraints.minHeight,
            Math.min(this._constraints.maxHeight, this._resizeStart.height + deltaY)
        );

        this._window.width = newWidth;
        this._window.height = newHeight;

        // Keep within screen bounds
        this._constrainToMonitor();

        return Clutter.EVENT_STOP;
    }

    _onResizeEnd(_actor, _event) {
        if (!this._isResizing) return Clutter.EVENT_PROPAGATE;

        this._isResizing = false;
        this._window.remove_style_class_name('betterkeys-window-resizing');
        return Clutter.EVENT_STOP;
    }

    _onWindowButtonPress(_actor, _event) {
        // Allow dragging in floating mode
        if (this._dockingPosition === 'floating') {
            // Start drag (optional)
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onWindowButtonRelease(_actor, _event) {
        return Clutter.EVENT_PROPAGATE;
    }

    _onWindowMotion(_actor, _event) {
        return Clutter.EVENT_PROPAGATE;
    }

    _updateMonitorGeometry() {
        let monitorIndex = global.display.get_primary_monitor();
        this._monitorGeometry = global.display.get_monitor_geometry(monitorIndex);
        this._monitorIndex = monitorIndex;
    }

    _onMonitorsChanged() {
        log('[betterKeys] Monitor configuration changed');
        this._updateMonitorGeometry();
        this._updatePosition();
    }

    _onWorkareasChanged() {
        log('[betterKeys] Work areas changed');
        this._updatePosition();
    }

    /**
     * Update window position based on docking position and monitor geometry.
     */
    _updatePosition() {
        if (!this._window || !this._monitorGeometry) return;

        let { width: monitorWidth, height: monitorHeight, x: monitorX, y: monitorY } = this._monitorGeometry;
        let windowWidth = this._window.width;
        let windowHeight = this._window.height;
        let padding = 20;

        switch (this._dockingPosition) {
            case 'top':
                this._window.x = monitorX + Math.floor((monitorWidth - windowWidth) / 2);
                this._window.y = monitorY + padding;
                break;
            case 'bottom':
                this._window.x = monitorX + Math.floor((monitorWidth - windowWidth) / 2);
                this._window.y = monitorY + monitorHeight - windowHeight - padding;
                break;
            case 'left':
                this._window.x = monitorX + padding;
                this._window.y = monitorY + Math.floor((monitorHeight - windowHeight) / 2);
                break;
            case 'right':
                this._window.x = monitorX + monitorWidth - windowWidth - padding;
                this._window.y = monitorY + Math.floor((monitorHeight - windowHeight) / 2);
                break;
            case 'floating':
                // Keep current position but constrain to monitor
                this._constrainToMonitor();
                break;
        }

        // Update resize handle visibility
        if (this._resizeHandle) {
            if (this._dockingPosition === 'floating') {
                this._resizeHandle.show();
            } else {
                this._resizeHandle.hide();
            }
        }
    }

    _constrainToMonitor() {
        if (!this._window || !this._monitorGeometry) return;

        let { width: monitorWidth, height: monitorHeight, x: monitorX, y: monitorY } = this._monitorGeometry;
        let windowWidth = this._window.width;
        let windowHeight = this._window.height;

        // Ensure window stays within monitor bounds
        let newX = Math.max(monitorX, Math.min(monitorX + monitorWidth - windowWidth, this._window.x));
        let newY = Math.max(monitorY, Math.min(monitorY + monitorHeight - windowHeight, this._window.y));

        this._window.x = newX;
        this._window.y = newY;
    }

    /**
     * Set docking position and update window.
     * @param {string} position - One of 'top', 'bottom', 'left', 'right', 'floating'.
     */
    setDockingPosition(position) {
        const validPositions = ['top', 'bottom', 'left', 'right', 'floating'];
        if (!validPositions.includes(position)) {
            logError(`[betterKeys] Invalid docking position: ${position}`);
            return;
        }

        this._dockingPosition = position;

        // Update floating position if switching to floating
        if (position === 'floating' && this._window) {
            // Center on screen initially
            let { width: monitorWidth, height: monitorHeight, x: monitorX, y: monitorY } = this._monitorGeometry;
            this._window.x = monitorX + Math.floor((monitorWidth - this._window.width) / 2);
            this._window.y = monitorY + Math.floor((monitorHeight - this._window.height) / 2);
        }

        this._updatePosition();
        log(`[betterKeys] Docking position set to ${position}`);
    }

    /**
     * Show the keyboard window with animation.
     */
    show() {
        if (this._isVisible || !this._window) return;

        // Add to stage
        Main.uiGroup.add_child(this._window);

        // Set initial opacity for fade-in
        this._window.opacity = 0;

        // Animate
        this._window.ease({
            opacity: 255,
            duration: this._animationDuration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._isVisible = true;
                log('[betterKeys] Keyboard window shown');
            }
        });
    }

    /**
     * Hide the keyboard window with animation.
     */
    hide() {
        if (!this._isVisible || !this._window) return;

        this._window.ease({
            opacity: 0,
            duration: this._animationDuration,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                Main.uiGroup.remove_child(this._window);
                this._isVisible = false;
                log('[betterKeys] Keyboard window hidden');
            }
        });
    }

    /**
     * Toggle keyboard visibility.
     */
    toggle() {
        if (this._isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Update window size constraints.
     * @param {Object} constraints - Object with minWidth, minHeight, maxWidth, maxHeight.
     */
    setConstraints(constraints) {
        Object.assign(this._constraints, constraints);
    }

    /**
     * Move window to specific monitor.
     * @param {number} monitorIndex - Monitor index.
     */
    setMonitor(monitorIndex) {
        let nMonitors = global.display.get_n_monitors();
        if (monitorIndex < 0 || monitorIndex >= nMonitors) {
            logError(`[betterKeys] Invalid monitor index: ${monitorIndex}`);
            return;
        }

        this._monitorIndex = monitorIndex;
        this._monitorGeometry = global.display.get_monitor_geometry(monitorIndex);
        this._updatePosition();
    }

    /**
     * Get current window geometry.
     * @returns {Object} - {x, y, width, height}
     */
    getGeometry() {
        if (!this._window) return null;
        return {
            x: this._window.x,
            y: this._window.y,
            width: this._window.width,
            height: this._window.height
        };
    }

    /**
     * Set window geometry (only in floating mode).
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} width - Width.
     * @param {number} height - Height.
     */
    setGeometry(x, y, width, height) {
        if (this._dockingPosition !== 'floating') {
            logError('[betterKeys] Cannot set geometry in non-floating mode');
            return;
        }

        if (this._window) {
            this._window.x = x;
            this._window.y = y;
            this._window.width = Math.max(this._constraints.minWidth, Math.min(this._constraints.maxWidth, width));
            this._window.height = Math.max(this._constraints.minHeight, Math.min(this._constraints.maxHeight, height));
            this._constrainToMonitor();
        }
    }

    destroy() {
        if (this._window) {
            this.hide();
            this._window.destroy();
            this._window = null;
        }

        if (this._keyboardUI) {
            this._keyboardUI.destroy();
            this._keyboardUI = null;
        }

        log('[betterKeys] WindowManager destroyed');
    }
});

// Export the WindowManager class
var WindowManager = betterKeysWindowManager;
