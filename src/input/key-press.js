/* src/input/key-press.js - Individual key press handling, repeat, feedback */

const { GObject, GLib } = imports.gi;

/**
 * KeyPressHandler manages individual key press/release logic,
 * modifier state tracking, key repeat, and triggers visual,
 * haptic, and sound feedback.
 */
const KeyPressHandler = GObject.registerClass(
class KeyPressHandler extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;

        // Key state tracking
        this._pressedKeys = new Map(); // keyLabel -> { pressTime, repeatCount, touchId }
        this._modifierStates = {
            shift: false,
            ctrl: false,
            alt: false,
            super: false
        };

        // Key repeat configuration
        this._repeatDelay = 500; // ms before repeat starts
        this._repeatInterval = 50; // ms between repeats
        this._repeatTimers = new Map(); // keyLabel -> timer ID

        // Feedback systems
        this._hapticFeedback = null;
        this._soundFeedback = null;
        this._visualFeedback = null;

        // Initialize feedback systems
        this._initFeedbackSystems();

        log('[betterKeys] KeyPressHandler initialized');
    }

    /**
     * Initialize feedback systems (haptic, sound, visual).
     */
    _initFeedbackSystems() {
        // Haptic feedback (requires GNOME Shell haptic support)
        try {
            // This is a placeholder; actual implementation depends on platform
            this._hapticFeedback = {
                trigger: () => {
                    log('[betterKeys] Haptic feedback triggered');
                }
            };
        } catch (error) {
            logError(`[betterKeys] Failed to initialize haptic feedback: ${error}`);
        }

        // Sound feedback (using GStreamer or system sounds)
        try {
            // Placeholder
            this._soundFeedback = {
                play: (soundType) => {
                    log(`[betterKeys] Playing sound: ${soundType}`);
                }
            };
        } catch (error) {
            logError(`[betterKeys] Failed to initialize sound feedback: ${error}`);
        }

        // Visual feedback is handled by the UI components
        this._visualFeedback = {
            highlightKey: (keyLabel, highlight) => {
                // Emit signal for UI to handle
                this.emit('visual-feedback', { keyLabel, highlight });
            }
        };
    }

    /**
     * Handle a key press event.
     * @param {string} keyLabel - Label of the pressed key.
     * @param {Object} modifierStates - Current modifier states (optional).
     * @param {number} touchId - Optional touch identifier.
     */
    handlePress(keyLabel, modifierStates = null, touchId = null) {
        if (this._pressedKeys.has(keyLabel)) {
            // Key is already pressed (multi‑touch on same key)
            return;
        }

        const pressTime = GLib.get_monotonic_time() / 1000; // milliseconds
        this._pressedKeys.set(keyLabel, {
            pressTime,
            repeatCount: 0,
            touchId
        });

        // Update modifier states if provided
        if (modifierStates) {
            this._modifierStates = { ...modifierStates };
        }

        // Trigger feedback
        this._triggerFeedback(keyLabel, 'press');

        // Start repeat timer for non‑modifier keys
        if (!this._isModifierKey(keyLabel)) {
            this._startKeyRepeat(keyLabel);
        }

        this.emit('key-pressed', keyLabel);
        log(`[betterKeys] Key pressed: ${keyLabel}`);
    }

    /**
     * Handle a key release event.
     * @param {string} keyLabel - Label of the released key.
     * @param {number} touchId - Optional touch identifier.
     */
    handleRelease(keyLabel, touchId = null) {
        const keyState = this._pressedKeys.get(keyLabel);
        if (!keyState) {
            return;
        }

        // If touchId is specified, ensure it matches (for multi‑touch)
        if (touchId !== null && keyState.touchId !== touchId) {
            // This touch didn't press this key; ignore
            return;
        }

        // Stop repeat timer
        this._stopKeyRepeat(keyLabel);

        // Remove from pressed keys
        this._pressedKeys.delete(keyLabel);

        // Update modifier states
        if (this._isModifierKey(keyLabel)) {
            this._updateModifierState(keyLabel, false);
        }

        // Trigger release feedback
        this._triggerFeedback(keyLabel, 'release');

        this.emit('key-released', keyLabel);
        log(`[betterKeys] Key released: ${keyLabel}`);
    }

    /**
     * Start key repeat timer for a key.
     * @param {string} keyLabel - Key label.
     */
    _startKeyRepeat(keyLabel) {
        // Clear any existing timer
        this._stopKeyRepeat(keyLabel);

        const timerId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this._repeatDelay,
            () => {
                this._onRepeatTimeout(keyLabel);
                return true; // continue repeating
            }
        );

        this._repeatTimers.set(keyLabel, timerId);
    }

    /**
     * Stop key repeat timer for a key.
     * @param {string} keyLabel - Key label.
     */
    _stopKeyRepeat(keyLabel) {
        const timerId = this._repeatTimers.get(keyLabel);
        if (timerId) {
            GLib.source_remove(timerId);
            this._repeatTimers.delete(keyLabel);
        }
    }

    /**
     * Called when repeat timeout occurs.
     * @param {string} keyLabel - Key label.
     */
    _onRepeatTimeout(keyLabel) {
        const keyState = this._pressedKeys.get(keyLabel);
        if (!keyState) {
            return false; // stop repeating
        }

        keyState.repeatCount++;
        this.emit('key-repeat', keyLabel, keyState.repeatCount);

        // Trigger feedback for each repeat
        this._triggerFeedback(keyLabel, 'repeat');

        // Change to faster repeat interval after first repeat
        const interval = keyState.repeatCount === 1 ? this._repeatInterval : this._repeatInterval;

        // Restart timer with new interval
        this._stopKeyRepeat(keyLabel);
        const timerId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            interval,
            () => {
                this._onRepeatTimeout(keyLabel);
                return true;
            }
        );
        this._repeatTimers.set(keyLabel, timerId);

        return false; // original timer stops
    }

    /**
     * Update key repeat timers (called periodically).
     * @param {number} currentTime - Current monotonic time in ms.
     */
    updateKeyRepeat(_currentTime) {
        // This method can be called from an update loop to handle
        // repeat logic without relying solely on GLib timers.
        // Currently using GLib timers, so this is a placeholder.
    }

    /**
     * Trigger feedback for a key event.
     * @param {string} keyLabel - Key label.
     * @param {string} eventType - 'press', 'release', or 'repeat'.
     */
    _triggerFeedback(keyLabel, eventType) {
        // Visual feedback
        if (this._visualFeedback) {
            const highlight = eventType === 'press' || eventType === 'repeat';
            this._visualFeedback.highlightKey(keyLabel, highlight);
        }

        // Haptic feedback
        if (this._hapticFeedback && this._settings.getHapticFeedbackEnabled()) {
            if (eventType === 'press') {
                this._hapticFeedback.trigger();
            }
        }

        // Sound feedback
        if (this._soundFeedback && this._settings.getKeyPressSoundEnabled()) {
            this._soundFeedback.play(eventType);
        }
    }

    /**
     * Check if a key is a modifier key.
     * @param {string} keyLabel - Key label.
     * @returns {boolean} True if modifier.
     */
    _isModifierKey(keyLabel) {
        const modifiers = ['Shift', 'Ctrl', 'Alt', 'Super', 'Meta', 'Control', 'AltGr'];
        return modifiers.includes(keyLabel);
    }

    /**
     * Update internal modifier state.
     * @param {string} keyLabel - Key label.
     * @param {boolean} pressed - Whether the key is pressed.
     */
    _updateModifierState(keyLabel, pressed) {
        switch (keyLabel) {
            case 'Shift':
                this._modifierStates.shift = pressed;
                break;
            case 'Ctrl':
                this._modifierStates.ctrl = pressed;
                break;
            case 'Alt':
                this._modifierStates.alt = pressed;
                break;
            case 'Super':
            case 'Meta':
                this._modifierStates.super = pressed;
                break;
        }
        this.emit('modifier-changed', { ...this._modifierStates });
    }

    /**
     * Get current modifier states.
     * @returns {Object} Modifier states.
     */
    getModifierStates() {
        return { ...this._modifierStates };
    }

    /**
     * Set modifier states (e.g., from external source).
     * @param {Object} states - New modifier states.
     */
    setModifierStates(states) {
        this._modifierStates = { ...states };
        this.emit('modifier-changed', this._modifierStates);
    }

    /**
     * Check if a specific modifier is active.
     * @param {string} modifier - Modifier name ('shift', 'ctrl', 'alt', 'super').
     * @returns {boolean} True if active.
     */
    isModifierActive(modifier) {
        return this._modifierStates[modifier] === true;
    }

    /**
     * Get currently pressed keys.
     * @returns {string[]} Array of pressed key labels.
     */
    getPressedKeys() {
        return Array.from(this._pressedKeys.keys());
    }

    /**
     * Check if a specific key is currently pressed.
     * @param {string} keyLabel - Key label.
     * @returns {boolean} True if pressed.
     */
    isKeyPressed(keyLabel) {
        return this._pressedKeys.has(keyLabel);
    }

    /**
     * Release all pressed keys (e.g., when keyboard hides).
     */
    releaseAllKeys() {
        const pressedKeys = this.getPressedKeys();
        pressedKeys.forEach(keyLabel => {
            this.handleRelease(keyLabel);
        });
        log('[betterKeys] All keys released');
    }

    /**
     * Set key repeat parameters.
     * @param {number} delay - Delay before repeat starts (ms).
     * @param {number} interval - Interval between repeats (ms).
     */
    setRepeatParameters(delay, interval) {
        this._repeatDelay = delay;
        this._repeatInterval = interval;
        log(`[betterKeys] Repeat parameters set: delay=${delay}ms, interval=${interval}ms`);
    }

    /**
     * Enable or disable key repeat.
     * @param {boolean} enable - Whether key repeat is enabled.
     */
    setKeyRepeatEnabled(enable) {
        if (!enable) {
            // Stop all repeat timers
            this._repeatTimers.forEach((timerId, _keyLabel) => {
                GLib.source_remove(timerId);
            });
            this._repeatTimers.clear();
        }
        // The repeat logic will respect this flag when starting timers
        this._keyRepeatEnabled = enable;
        this.emit('key-repeat-enabled', enable);
    }

    /**
     * Simulate a key press and release (for testing).
     * @param {string} keyLabel - Key label.
     * @param {number} duration - How long to hold (ms).
     */
    simulateKeyTap(keyLabel, duration = 100) {
        this.handlePress(keyLabel);
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            this.handleRelease(keyLabel);
            return false;
        });
    }
});

// Add signals to the class
KeyPressHandler.signals = {
    'key-pressed': { param_types: [GObject.TYPE_STRING] },
    'key-released': { param_types: [GObject.TYPE_STRING] },
    'key-repeat': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT] },
    'modifier-changed': { param_types: [GObject.TYPE_POINTER] },
    'visual-feedback': { param_types: [GObject.TYPE_POINTER] },
    'key-repeat-enabled': { param_types: [GObject.TYPE_BOOLEAN] }
};
