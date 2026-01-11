/* src/keyboard/manager.js - Keyboard lifecycle and state management */

const { GObject, Clutter, GLib } = imports.gi;

/**
 * KeyboardManager handles keyboard lifecycle, layout loading,
 * key state management, multi-touch, positioning, and window focus tracking.
 */
const KeyboardManager = GObject.registerClass(
class KeyboardManager extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._keyboardUI = null;
        this._layoutManager = null;
        this._inputHandler = null;
        this._textEngine = null;
        this._keyPressHandler = null;

        // State
        this._isVisible = false;
        this._isEnabled = false;
        this._currentLayoutId = 'en_US_qwerty';
        this._keyStates = new Map(); // keyLabel -> { pressed: bool, touchIds: Set }
        this._modifierStates = {
            shift: false,
            ctrl: false,
            alt: false,
            super: false
        };
        this._multiTouchPoints = new Map(); // touchId -> keyLabel

        // Window focus tracking
        this._windowTracker = null;
        this._activeWindow = null;
        this._applicationLayouts = new Map(); // appId -> layoutId

        // Positioning
        this._dockingMode = 'bottom'; // 'bottom', 'top', 'floating'
        this._keyboardHeight = 0;
        this._keyboardWidth = 0;

        // Performance
        this._animationFrameId = 0;
        this._lastUpdateTime = 0;

        log('[betterKeys] KeyboardManager initialized');
    }

    /**
     * Enable the keyboard manager.
     * @param {KeyboardUI} keyboardUI - The keyboard UI instance.
     * @param {InputEventHandler} inputHandler - Input event handler.
     * @param {LayoutManager} layoutManager - Layout manager.
     * @param {TextEngine} textEngine - Text input engine.
     * @param {KeyPressHandler} keyPressHandler - Key press handler.
     */
    enable(keyboardUI, inputHandler, layoutManager, textEngine, keyPressHandler) {
        if (this._isEnabled) {
            return;
        }

        log('[betterKeys] Enabling keyboard manager');

        this._keyboardUI = keyboardUI;
        this._inputHandler = inputHandler;
        this._layoutManager = layoutManager;
        this._textEngine = textEngine;
        this._keyPressHandler = keyPressHandler;

        // Load current layout
        this._currentLayoutId = this._settings.getCurrentLayout();
        this._loadLayout(this._currentLayoutId);

        // Connect to settings changes
        this._settings.connect('changed', this._onSettingsChanged.bind(this));

        // Set up window focus tracking
        this._setupWindowTracking();

        // Start update loop for animations
        this._startUpdateLoop();

        this._isEnabled = true;
        log('[betterKeys] Keyboard manager enabled');
    }

    /**
     * Disable the keyboard manager.
     */
    disable() {
        if (!this._isEnabled) {
            return;
        }

        log('[betterKeys] Disabling keyboard manager');

        // Stop update loop
        this._stopUpdateLoop();

        // Disconnect settings
        if (this._settings) {
            this._settings.disconnect(this._settingsChangedId);
        }

        // Clean up window tracking
        this._cleanupWindowTracking();

        // Clear state
        this._keyStates.clear();
        this._multiTouchPoints.clear();
        this._modifierStates = {
            shift: false,
            ctrl: false,
            alt: false,
            super: false
        };

        this._isEnabled = false;
        this._isVisible = false;
        log('[betterKeys] Keyboard manager disabled');
    }

    /**
     * Load a keyboard layout.
     * @param {string} layoutId - Layout identifier.
     */
    _loadLayout(layoutId) {
        if (!this._layoutManager) {
            logError('[betterKeys] Layout manager not available');
            return;
        }

        try {
            const layout = this._layoutManager.loadLayout(layoutId);
            if (layout) {
                this._currentLayoutId = layoutId;
                this.emit('layout-changed', layoutId);

                // Update keyboard UI if available
                if (this._keyboardUI) {
                    this._keyboardUI.setLayout(layout);
                }

                log(`[betterKeys] Loaded layout: ${layoutId}`);
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load layout ${layoutId}: ${error}`);
        }
    }

    /**
     * Switch to a different layout.
     * @param {string} layoutId - New layout identifier.
     */
    switchLayout(layoutId) {
        if (layoutId === this._currentLayoutId) {
            return;
        }

        this._loadLayout(layoutId);
    }

    /**
     * Show the keyboard.
     */
    show() {
        if (!this._isEnabled || this._isVisible) {
            return;
        }

        if (this._keyboardUI) {
            this._keyboardUI.show();
            this._isVisible = true;
            this.emit('visibility-changed', true);

            // Update keyboard dimensions
            this._keyboardWidth = this._keyboardUI.width;
            this._keyboardHeight = this._keyboardUI.height;

            log('[betterKeys] Keyboard shown');
        }
    }

    /**
     * Hide the keyboard.
     */
    hide() {
        if (!this._isEnabled || !this._isVisible) {
            return;
        }

        if (this._keyboardUI) {
            this._keyboardUI.hide();
            this._isVisible = false;
            this.emit('visibility-changed', false);

            // Release all pressed keys
            this._releaseAllKeys();

            log('[betterKeys] Keyboard hidden');
        }
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
     * Handle key press event.
     * @param {string} keyLabel - Label of the pressed key.
     * @param {number} touchId - Optional touch identifier.
     */
    handleKeyPress(keyLabel, touchId = null) {
        if (!this._isEnabled) {
            return;
        }

        // Update key state
        let state = this._keyStates.get(keyLabel);
        if (!state) {
            state = { pressed: true, touchIds: new Set() };
            this._keyStates.set(keyLabel, state);
        } else {
            state.pressed = true;
        }
        if (touchId !== null) {
            state.touchIds.add(touchId);
            this._multiTouchPoints.set(touchId, keyLabel);
        }

        // Handle modifier keys
        this._updateModifierState(keyLabel, true);

        // Forward to key press handler
        if (this._keyPressHandler) {
            this._keyPressHandler.handlePress(keyLabel, this._modifierStates);
        }

        // Forward to text engine for character keys
        if (this._textEngine && this._isCharacterKey(keyLabel)) {
            const character = this._getCharacterForKey(keyLabel);
            this._textEngine.insertText(character);
        }

        this.emit('key-pressed', keyLabel);
    }

    /**
     * Handle key release event.
     * @param {string} keyLabel - Label of the released key.
     * @param {number} touchId - Optional touch identifier.
     */
    handleKeyRelease(keyLabel, touchId = null) {
        if (!this._isEnabled) {
            return;
        }

        // Update key state
        const state = this._keyStates.get(keyLabel);
        if (state) {
            if (touchId !== null) {
                state.touchIds.delete(touchId);
                this._multiTouchPoints.delete(touchId);
            }
            if (state.touchIds.size === 0) {
                state.pressed = false;
            }
        }

        // Handle modifier keys
        this._updateModifierState(keyLabel, false);

        // Forward to key press handler
        if (this._keyPressHandler) {
            this._keyPressHandler.handleRelease(keyLabel);
        }

        this.emit('key-released', keyLabel);
    }

    /**
     * Release all currently pressed keys.
     */
    _releaseAllKeys() {
        for (const [keyLabel, state] of this._keyStates) {
            if (state.pressed) {
                this.handleKeyRelease(keyLabel);
            }
        }
        this._multiTouchPoints.clear();
    }

    /**
     * Update modifier key states.
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
                this._modifierStates.super = pressed;
                break;
        }
    }

    /**
     * Check if a key label corresponds to a character key.
     * @param {string} keyLabel - Key label.
     * @returns {boolean} True if character key.
     */
    _isCharacterKey(keyLabel) {
        // Single character keys (excluding modifiers, space, etc.)
        return keyLabel.length === 1 && /[A-Za-z0-9]/.test(keyLabel);
    }

    /**
     * Get the character to insert for a key, considering modifiers.
     * @param {string} keyLabel - Key label.
     * @returns {string} Character to insert.
     */
    _getCharacterForKey(keyLabel) {
        if (this._modifierStates.shift) {
            // For simplicity, assume uppercase
            return keyLabel.toUpperCase();
        }
        return keyLabel.toLowerCase();
    }

    /**
     * Handle multi-touch point assignment.
     * @param {number} touchId - Touch identifier.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     */
    assignTouchToKey(touchId, x, y) {
        if (!this._keyboardUI) {
            return null;
        }

        // Determine which key is at (x, y)
        const keyLabel = this._keyboardUI.getKeyAtPosition(x, y);
        if (keyLabel) {
            this._multiTouchPoints.set(touchId, keyLabel);
            this.handleKeyPress(keyLabel, touchId);
            return keyLabel;
        }
        return null;
    }

    /**
     * Release touch point.
     * @param {number} touchId - Touch identifier.
     */
    releaseTouch(touchId) {
        const keyLabel = this._multiTouchPoints.get(touchId);
        if (keyLabel) {
            this.handleKeyRelease(keyLabel, touchId);
        }
        this._multiTouchPoints.delete(touchId);
    }

    /**
     * Set keyboard docking mode.
     * @param {string} mode - Docking mode ('bottom', 'top', 'floating').
     */
    setDockingMode(mode) {
        if (!['bottom', 'top', 'floating'].includes(mode)) {
            logError(`[betterKeys] Invalid docking mode: ${mode}`);
            return;
        }

        this._dockingMode = mode;
        this._updateKeyboardPosition();

        log(`[betterKeys] Docking mode set to ${mode}`);
    }

    /**
     * Update keyboard position based on docking mode and screen size.
     */
    _updateKeyboardPosition() {
        if (!this._keyboardUI || !this._isVisible) {
            return;
        }

        const [screenWidth, screenHeight] = global.stage.get_size();
        let x = 0;
        let y = 0;

        switch (this._dockingMode) {
            case 'bottom':
                x = Math.floor((screenWidth - this._keyboardWidth) / 2);
                y = screenHeight - this._keyboardHeight - 50; // 50px margin
                break;
            case 'top':
                x = Math.floor((screenWidth - this._keyboardWidth) / 2);
                y = 50; // 50px margin
                break;
            case 'floating':
                // Keep current position (or implement drag)
                break;
        }

        this._keyboardUI.set_position(x, y);
        this.emit('position-changed', { x, y });
    }

    /**
     * Set up window focus tracking.
     */
    _setupWindowTracking() {
        try {
            this._windowTracker = imports.ui.windowTracker.get_window_tracker();
            if (this._windowTracker) {
                this._windowTracker.connect('notify::focus-app', this._onFocusAppChanged.bind(this));
            }
        } catch (error) {
            logError(`[betterKeys] Failed to set up window tracking: ${error}`);
        }
    }

    /**
     * Clean up window tracking.
     */
    _cleanupWindowTracking() {
        if (this._windowTracker) {
            this._windowTracker.disconnect(this._focusAppChangedId);
            this._windowTracker = null;
        }
    }

    /**
     * Handle focus application change.
     */
    _onFocusAppChanged() {
        if (!this._windowTracker) {
            return;
        }

        const focusedApp = this._windowTracker.focus_app;
        if (focusedApp) {
            const appId = focusedApp.get_id();
            this._activeWindow = appId;

            // Check if there's an application-specific layout
            const appLayout = this._applicationLayouts.get(appId);
            if (appLayout && appLayout !== this._currentLayoutId) {
                this.switchLayout(appLayout);
            }

            this.emit('focus-changed', appId);
        }
    }

    /**
     * Set application-specific layout.
     * @param {string} appId - Application identifier.
     * @param {string} layoutId - Layout identifier.
     */
    setApplicationLayout(appId, layoutId) {
        this._applicationLayouts.set(appId, layoutId);
        this.emit('application-layout-changed', { appId, layoutId });
    }

    /**
     * Remove application-specific layout.
     * @param {string} appId - Application identifier.
     */
    removeApplicationLayout(appId) {
        this._applicationLayouts.delete(appId);
        this.emit('application-layout-removed', appId);
    }

    /**
     * Handle settings changes.
     */
    _onSettingsChanged(settings, key) {
        switch (key) {
            case 'current-layout':
                const newLayout = this._settings.getCurrentLayout();
                if (newLayout !== this._currentLayoutId) {
                    this.switchLayout(newLayout);
                }
                break;
            case 'docking-mode':
                const mode = this._settings.getString('docking-mode');
                this.setDockingMode(mode);
                break;
        }
    }

    /**
     * Start the update loop for animations and state updates.
     */
    _startUpdateLoop() {
        const update = () => {
            this._update();
            this._animationFrameId = Clutter.threads_add_timeout(16, update); // ~60fps
        };
        this._animationFrameId = Clutter.threads_add_timeout(16, update);
    }

    /**
     * Stop the update loop.
     */
    _stopUpdateLoop() {
        if (this._animationFrameId) {
            Clutter.threads_remove_timeout(this._animationFrameId);
            this._animationFrameId = 0;
        }
    }

    /**
     * Update keyboard state (animations, key repeat, etc.)
     */
    _update() {
        const now = GLib.get_monotonic_time() / 1000; // milliseconds

        // Handle key repeat
        if (this._keyPressHandler) {
            this._keyPressHandler.updateKeyRepeat(now);
        }

        // Update keyboard UI animations
        if (this._keyboardUI) {
            this._keyboardUI.updateAnimations(now);
        }

        this._lastUpdateTime = now;
    }

    /**
     * Get current keyboard state.
     * @returns {Object} State object.
     */
    getState() {
        return {
            isVisible: this._isVisible,
            isEnabled: this._isEnabled,
            currentLayout: this._currentLayoutId,
            modifierStates: { ...this._modifierStates },
            dockingMode: this._dockingMode,
            activeWindow: this._activeWindow,
            pressedKeys: Array.from(this._keyStates.entries())
                .filter(([_, state]) => state.pressed)
                .map(([label]) => label)
        };
    }
});

// Add signals to the class
KeyboardManager.signals = {
    'layout-changed': { param_types: [GObject.TYPE_STRING] },
    'visibility-changed': { param_types: [GObject.TYPE_BOOLEAN] },
    'key-pressed': { param_types: [GObject.TYPE_STRING] },
    'key-released': { param_types: [GObject.TYPE_STRING] },
    'position-changed': { param_types: [GObject.TYPE_POINTER] },
    'focus-changed': { param_types: [GObject.TYPE_STRING] },
    'application-layout-changed': { param_types: [GObject.TYPE_POINTER] },
    'application-layout-removed': { param_types: [GObject.TYPE_STRING] }
};
