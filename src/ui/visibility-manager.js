/* src/ui/visibility-manager.js - Keyboard visibility management */

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

export const VisibilityManager = GObject.registerClass(
class VisibilityManager extends GObject.Object {
    _init(settingsManager, windowManager) {
        super._init();

        this._settings = settingsManager;
        this._windowManager = windowManager;
        this._keyboardUI = null;
        this._isVisible = false;
        this._autoShowEnabled = true;
        this._hotkeyId = 0;
        this._focusTracker = null;
        this._keyFocusTracker = null;
        this._lastFocusedWindow = null;
        this._lastFocusedActor = null;
        this._visibilityTimeoutId = 0;
        this._hideDelay = 500; // ms
        this._showDelay = 100; // ms

        // Load settings
        this._autoShowEnabled = this._settings.getBoolean('auto-show-enabled');

        // Connect to settings changes
        this._settings.connect('changed::auto-show-enabled', this._onAutoShowSettingChanged.bind(this));

        log('[betterKeys] VisibilityManager initialized');
    }

    /**
     * Set the keyboard UI instance.
     * @param {KeyboardUI} keyboardUI - The keyboard UI widget.
     */
    setKeyboardUI(keyboardUI) {
        this._keyboardUI = keyboardUI;
    }

    /**
     * Enable visibility management.
     */
    enable() {
        log('[betterKeys] Enabling visibility management');

        // Register hotkey (Super+K)
        this._registerHotkey();

        // Start focus tracking
        this._startFocusTracking();

        // Restore previous visibility state (optional)
        // For now, start hidden
        this.hide();
    }

    /**
     * Disable visibility management.
     */
    disable() {
        log('[betterKeys] Disabling visibility management');

        // Unregister hotkey
        this._unregisterHotkey();

        // Stop focus tracking
        this._stopFocusTracking();

        // Hide keyboard
        this.hide();

        // Clear any pending timeouts
        this._clearTimeouts();
    }

    _registerHotkey() {
        // Register Super+K to toggle keyboard
        this._hotkeyId = global.display.add_keybinding(
            'betterkeys-toggle-keyboard',
            new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.betterkeys' }),
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL,
            this.toggle.bind(this)
        );
        log('[betterKeys] Registered hotkey Super+K');
    }

    _unregisterHotkey() {
        if (this._hotkeyId) {
            global.display.remove_keybinding('betterkeys-toggle-keyboard');
            this._hotkeyId = 0;
        }
    }

    _startFocusTracking() {
        // Track window focus changes
        this._focusTracker = global.display.connect('notify::focus-window', this._onFocusWindowChanged.bind(this));

        // Also track stage events for actor focus
        this._keyFocusTracker = global.stage.connect('notify::key-focus', this._onKeyFocusChanged.bind(this));

        log('[betterKeys] Started focus tracking');
    }

    _stopFocusTracking() {
        if (this._focusTracker) {
            global.display.disconnect(this._focusTracker);
            this._focusTracker = null;
        }

        if (this._keyFocusTracker) {
            global.stage.disconnect(this._keyFocusTracker);
            this._keyFocusTracker = null;
        }
    }

    _onFocusWindowChanged() {
        const focusWindow = global.display.focus_window;
        if (!focusWindow) return;

        // Check if the focused window is a text input
        const windowType = focusWindow.get_window_type();
        const isDialog = windowType === Meta.WindowType.DIALOG;
        const isNormal = windowType === Meta.WindowType.NORMAL;

        // Determine if we should show keyboard
        if (this._autoShowEnabled && (isNormal || isDialog)) {
            // Delay show to avoid flickering
            this._scheduleShow();
        } else {
            // Hide keyboard when focus moves to non-text window
            this._scheduleHide();
        }

        this._lastFocusedWindow = focusWindow;
    }

    _onKeyFocusChanged() {
        const keyFocus = global.stage.key_focus;
        if (!keyFocus) return;

        // Check if the focused actor is a text input
        const isTextInput = this._isTextInput(keyFocus);

        if (this._autoShowEnabled && isTextInput) {
            this._scheduleShow();
        } else if (!isTextInput) {
            this._scheduleHide();
        }

        this._lastFocusedActor = keyFocus;
    }

    _isTextInput(actor) {
        // Heuristic: check if actor is a St.Entry or similar
        if (actor && actor.toString().includes('Entry')) {
            return true;
        }

        // Check for accessible role
        try {
            const role = actor.get_accessible_role();
            if (role === Atk.Role.ENTRY || role === Atk.Role.TEXT) {
                return true;
            }
        } catch {}

        return false;
    }

    _scheduleShow() {
        this._clearTimeouts();

        this._visibilityTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._showDelay, () => {
            this.show();
            this._visibilityTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _scheduleHide() {
        this._clearTimeouts();

        this._visibilityTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._hideDelay, () => {
            this.hide();
            this._visibilityTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _clearTimeouts() {
        if (this._visibilityTimeoutId) {
            GLib.source_remove(this._visibilityTimeoutId);
            this._visibilityTimeoutId = 0;
        }
    }

    _onAutoShowSettingChanged() {
        this._autoShowEnabled = this._settings.getBoolean('auto-show-enabled');
        log(`[betterKeys] Auto-show setting changed to ${this._autoShowEnabled}`);

        if (!this._autoShowEnabled && this._isVisible) {
            // If auto-show disabled and keyboard is visible due to auto-show, hide it
            // (but keep if manually shown)
            // For simplicity, we just hide
            this.hide();
        }
    }

    /**
     * Show the keyboard.
     */
    show() {
        if (this._isVisible) return;

        log('[betterKeys] Showing keyboard (visibility manager)');

        if (this._windowManager) {
            this._windowManager.show();
        } else if (this._keyboardUI) {
            this._keyboardUI.show();
        }

        this._isVisible = true;
        this.emit('visibility-changed', true);
    }

    /**
     * Hide the keyboard.
     */
    hide() {
        if (!this._isVisible) return;

        log('[betterKeys] Hiding keyboard (visibility manager)');

        if (this._windowManager) {
            this._windowManager.hide();
        } else if (this._keyboardUI) {
            this._keyboardUI.hide();
        }

        this._isVisible = false;
        this.emit('visibility-changed', false);
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
     * Check if keyboard is currently visible.
     * @returns {boolean} Visibility state.
     */
    isVisible() {
        return this._isVisible;
    }

    /**
     * Set auto-show behavior.
     * @param {boolean} enabled - Whether auto-show is enabled.
     */
    setAutoShowEnabled(enabled) {
        this._autoShowEnabled = enabled;
        this._settings.setBoolean('auto-show-enabled', enabled);
    }

    /**
     * Force show keyboard (overrides auto-show logic).
     */
    forceShow() {
        this._clearTimeouts();
        this.show();
    }

    /**
     * Force hide keyboard (overrides auto-show logic).
     */
    forceHide() {
        this._clearTimeouts();
        this.hide();
    }

    destroy() {
        this.disable();
        this._clearTimeouts();

        if (this._keyboardUI) {
            this._keyboardUI.destroy();
            this._keyboardUI = null;
        }

        log('[betterKeys] VisibilityManager destroyed');
    }
});

// Add signals to the class
VisibilityManager.signals = {
    'visibility-changed': { param_types: [GObject.TYPE_BOOLEAN] }
};
