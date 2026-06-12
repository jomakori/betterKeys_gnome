/* src/ui/accessibility.js - Enhanced Accessibility features for betterKeys */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const AccessibilityManager = GObject.registerClass(
class AccessibilityManager extends GObject.Object {
    _init(settingsManager, themeManager) {
        super._init();

        this._settings = settingsManager;
        this._themeManager = themeManager;
        this._keyboardUI = null;
        this._screenReaderEnabled = false;
        this._highContrastEnabled = false;
        this._largeKeysEnabled = false;
        this._slowMotionEnabled = false;
        this._focusRingVisible = true;
        this._tooltipTimeoutId = 0;
        this._currentFocusIndex = -1;
        this._focusableKeys = [];
        this._stickyKeys = new Map(); // modifier -> active
        this._keyRepeatDelay = 500; // ms
        this._keyRepeatInterval = 100; // ms
        this._keyRepeatTimeoutId = 0;
        this._voiceInputEnabled = false;
        this._colorBlindMode = 'none'; // 'none', 'protanopia', 'deuteranopia', 'tritanopia'
        this._dyslexiaFontEnabled = false;
        this._stickyKeysEnabled = false;
        this._audioFeedbackEnabled = false;
        this._hapticFeedbackEnabled = false;

        // Load settings
        this._loadSettings();

        // Connect to settings changes
        this._settings.connect('changed', this._onSettingsChanged.bind(this));

        // Detect screen reader
        this._detectScreenReader();

        // Setup AT-SPI event listeners
        this._setupScreenReaderSupport();

        log('[betterKeys] Enhanced AccessibilityManager initialized');
    }

    _loadSettings() {
        this._highContrastEnabled = this._settings.getBoolean('high-contrast-enabled');
        this._largeKeysEnabled = this._settings.getBoolean('large-keys-enabled');
        this._slowMotionEnabled = this._settings.getBoolean('slow-motion-enabled');
        this._focusRingVisible = this._settings.getBoolean('focus-ring-visible');
        this._stickyKeysEnabled = this._settings.getBoolean('sticky-keys-enabled');
        this._keyRepeatDelay = this._settings.getInt('key-repeat-delay');
        this._keyRepeatInterval = this._settings.getInt('key-repeat-interval');
        this._voiceInputEnabled = this._settings.getBoolean('voice-input-enabled');
        this._colorBlindMode = this._settings.getString('color-blind-mode');
        this._dyslexiaFontEnabled = this._settings.getBoolean('dyslexia-font-enabled');
        this._audioFeedbackEnabled = this._settings.getBoolean('audio-feedback-enabled');
        this._hapticFeedbackEnabled = this._settings.getBoolean('haptic-feedback-enabled');
    }

    _detectScreenReader() {
        // Check if AT-SPI is active
        try {
            const tracker = Atk.Registry.get_default();
            this._screenReaderEnabled = tracker !== null;
            if (this._screenReaderEnabled) {
                // Attempt to get the screen reader state
                const screenReader = Atk.Registry.get_default().get_toolkit_name();
                log(`[betterKeys] Screen reader detected: ${screenReader}`);
            }
        } catch (_e) {
            this._screenReaderEnabled = false;
        }

        log(`[betterKeys] Screen reader detected: ${this._screenReaderEnabled}`);
    }

    _setupScreenReaderSupport() {
        if (!this._screenReaderEnabled) return;

        // Register as accessible object
        // This is a placeholder; actual AT-SPI registration would be more complex
        log('[betterKeys] Setting up screen reader support');
    }

    _onSettingsChanged(settings, key) {
        switch (key) {
            case 'high-contrast-enabled':
                this._highContrastEnabled = settings.getBoolean(key);
                this._applyHighContrast();
                break;
            case 'large-keys-enabled':
                this._largeKeysEnabled = settings.getBoolean(key);
                this._applyLargeKeys();
                break;
            case 'slow-motion-enabled':
                this._slowMotionEnabled = settings.getBoolean(key);
                this._applySlowMotion();
                break;
            case 'focus-ring-visible':
                this._focusRingVisible = settings.getBoolean(key);
                this._applyFocusRing();
                break;
            case 'sticky-keys-enabled':
                this._stickyKeysEnabled = settings.getBoolean(key);
                this._applyStickyKeys();
                break;
            case 'key-repeat-delay':
                this._keyRepeatDelay = settings.getInt(key);
                break;
            case 'key-repeat-interval':
                this._keyRepeatInterval = settings.getInt(key);
                break;
            case 'voice-input-enabled':
                this._voiceInputEnabled = settings.getBoolean(key);
                this._applyVoiceInput();
                break;
            case 'color-blind-mode':
                this._colorBlindMode = settings.getString(key);
                this._applyColorBlindMode();
                break;
            case 'dyslexia-font-enabled':
                this._dyslexiaFontEnabled = settings.getBoolean(key);
                this._applyDyslexiaFont();
                break;
            case 'audio-feedback-enabled':
                this._audioFeedbackEnabled = settings.getBoolean(key);
                break;
            case 'haptic-feedback-enabled':
                this._hapticFeedbackEnabled = settings.getBoolean(key);
                break;
        }
    }

    /**
     * Set the keyboard UI instance.
     * @param {KeyboardUI} keyboardUI - The keyboard UI widget.
     */
    setKeyboardUI(keyboardUI) {
        this._keyboardUI = keyboardUI;

        // Apply accessibility features to the keyboard
        this._applyAccessibilityFeatures();
    }

    _applyAccessibilityFeatures() {
        if (!this._keyboardUI) return;

        // Ensure keyboard is accessible
        this._keyboardUI.set_accessible_role(Atk.Role.PANEL);
        this._keyboardUI.set_accessible_name(_('Virtual Keyboard'));
        this._keyboardUI.set_accessible_description(_('An on-screen keyboard for text input'));

        // Apply high contrast if enabled
        if (this._highContrastEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-accessibility-high-contrast');
        }

        // Apply large keys if enabled
        if (this._largeKeysEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-size-extra-large');
        }

        // Apply dyslexia-friendly font
        if (this._dyslexiaFontEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-dyslexia-friendly');
        }

        // Apply color blind mode
        this._applyColorBlindMode();

        // Make all keys focusable for keyboard navigation
        this._setupKeyboardNavigation();

        // Apply focus ring visibility
        this._applyFocusRing();

        // Apply sticky keys
        this._applyStickyKeys();

        // Apply voice input button if enabled
        if (this._voiceInputEnabled) {
            this._addVoiceInputButton();
        }
    }

    _applyHighContrast() {
        if (!this._keyboardUI) return;

        if (this._highContrastEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-accessibility-high-contrast');
            // Also update theme manager to high-contrast theme
            if (this._themeManager) {
                this._themeManager.setTheme('high-contrast');
            }
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-accessibility-high-contrast');
        }
    }

    _applyLargeKeys() {
        if (!this._keyboardUI) return;

        if (this._largeKeysEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-size-extra-large');
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-size-extra-large');
        }
    }

    _applySlowMotion() {
        // Adjust animation speeds
        if (this._slowMotionEnabled) {
            // Increase animation durations globally
            // This would affect animation manager; for now we just log
            log('[betterKeys] Slow motion enabled - animations will be slower');
        } else {
            log('[betterKeys] Slow motion disabled');
        }
    }

    _applyFocusRing() {
        if (!this._keyboardUI) return;

        if (this._focusRingVisible) {
            this._keyboardUI.add_style_class_name('betterkeys-focus-ring-visible');
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-focus-ring-visible');
        }
    }

    _applyStickyKeys() {
        if (!this._keyboardUI) return;

        if (this._stickyKeysEnabled) {
            // Add sticky keys indicator
            this._keyboardUI.add_style_class_name('betterkeys-sticky-keys-enabled');
            log('[betterKeys] Sticky keys enabled');
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-sticky-keys-enabled');
            // Deactivate any active sticky keys
            this._stickyKeys.clear();
        }
    }

    _applyVoiceInput() {
        if (!this._keyboardUI) return;

        if (this._voiceInputEnabled) {
            this._addVoiceInputButton();
        } else {
            this._removeVoiceInputButton();
        }
    }

    _applyColorBlindMode() {
        if (!this._keyboardUI) return;

        // Remove previous color blind classes
        this._keyboardUI.remove_style_class_name('betterkeys-color-blind-protanopia');
        this._keyboardUI.remove_style_class_name('betterkeys-color-blind-deuteranopia');
        this._keyboardUI.remove_style_class_name('betterkeys-color-blind-tritanopia');

        // Add appropriate class
        if (this._colorBlindMode !== 'none') {
            this._keyboardUI.add_style_class_name(`betterkeys-color-blind-${this._colorBlindMode}`);
        }

        // Also adjust theme colors if theme manager supports it
        if (this._themeManager) {
            // Could apply a color-blind friendly palette
            log(`[betterKeys] Color blind mode: ${this._colorBlindMode}`);
        }
    }

    _applyDyslexiaFont() {
        if (!this._keyboardUI) return;

        if (this._dyslexiaFontEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-dyslexia-friendly');
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-dyslexia-friendly');
        }
    }

    _addVoiceInputButton() {
        // This is a placeholder; actual implementation would create a button
        log('[betterKeys] Voice input button added (placeholder)');
    }

    _removeVoiceInputButton() {
        log('[betterKeys] Voice input button removed');
    }

    _setupKeyboardNavigation() {
        if (!this._keyboardUI) return;

        // Collect all key actors
        this._focusableKeys = this._keyboardUI._keys || [];

        // Set each key as focusable
        this._focusableKeys.forEach((key, index) => {
            key.can_focus = true;
            key.set_accessible_role(Atk.Role.PUSH_BUTTON);
            key.set_accessible_name(key.getLabel() || `Key ${index}`);

            // Connect to focus events
            key.connect('notify::has-focus', this._onKeyFocusChanged.bind(this));
        });

        // Connect keyboard events for navigation
        this._keyboardUI.connect('key-press-event', this._onKeyboardNavigation.bind(this));

        log(`[betterKeys] Keyboard navigation setup for ${this._focusableKeys.length} keys`);
    }

    _onKeyFocusChanged(key) {
        if (key.has_focus) {
            // Announce key label via screen reader
            this._announceKey(key.getLabel());

            // Show visual focus indicator
            key.add_style_class_name('betterkeys-key-focus');

            // Provide audio feedback if enabled
            if (this._audioFeedbackEnabled) {
                this._provideAudioFeedback('focus');
            }
        } else {
            key.remove_style_class_name('betterkeys-key-focus');
        }
    }

    _onKeyboardNavigation(actor, event) {
        const keyval = event.get_key_symbol();
        const state = event.get_state();

        // Handle Tab navigation
        if (keyval === Clutter.Tab && !(state & Clutter.ModifierType.SHIFT_MASK)) {
            this._moveFocusForward();
            return Clutter.EVENT_STOP;
        } else if (keyval === Clutter.Tab && (state & Clutter.ModifierType.SHIFT_MASK)) {
            this._moveFocusBackward();
            return Clutter.EVENT_STOP;
        }

        // Arrow key navigation
        switch (keyval) {
            case Clutter.Left:
                this._moveFocusLeft();
                return Clutter.EVENT_STOP;
            case Clutter.Right:
                this._moveFocusRight();
                return Clutter.EVENT_STOP;
            case Clutter.Up:
                this._moveFocusUp();
                return Clutter.EVENT_STOP;
            case Clutter.Down:
                this._moveFocusDown();
                return Clutter.EVENT_STOP;
            case Clutter.Return:
            case Clutter.KP_Enter:
                if (this._currentFocusIndex >= 0) {
                    const key = this._focusableKeys[this._currentFocusIndex];
                    key.emit('pressed', key.getLabel());
                    if (this._audioFeedbackEnabled) {
                        this._provideAudioFeedback('press');
                    }
                    if (this._hapticFeedbackEnabled) {
                        this._provideHapticFeedback();
                    }
                }
                return Clutter.EVENT_STOP;
            case Clutter.Escape:
                // Exit keyboard navigation
                this._clearFocus();
                return Clutter.EVENT_STOP;
            case Clutter.Shift_L:
            case Clutter.Shift_R:
            case Clutter.Control_L:
            case Clutter.Control_R:
            case Clutter.Alt_L:
            case Clutter.Alt_R:
            case Clutter.Super_L:
            case Clutter.Super_R:
                // Handle sticky keys
                if (this._stickyKeysEnabled) {
                    this._toggleStickyKey(keyval);
                    return Clutter.EVENT_STOP;
                }
                break;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _moveFocusForward() {
        if (this._focusableKeys.length === 0) return;

        this._currentFocusIndex = (this._currentFocusIndex + 1) % this._focusableKeys.length;
        this._focusableKeys[this._currentFocusIndex].grab_key_focus();
    }

    _moveFocusBackward() {
        if (this._focusableKeys.length === 0) return;

        this._currentFocusIndex = (this._currentFocusIndex - 1 + this._focusableKeys.length) % this._focusableKeys.length;
        this._focusableKeys[this._currentFocusIndex].grab_key_focus();
    }

    _moveFocusLeft() {
        // Simplified: move to previous key in row
        this._moveFocusBackward();
    }

    _moveFocusRight() {
        this._moveFocusForward();
    }

    _moveFocusUp() {
        // Move up one row (simplified)
        const keysPerRow = 10; // approximate
        this._currentFocusIndex = Math.max(0, this._currentFocusIndex - keysPerRow);
        this._focusableKeys[this._currentFocusIndex].grab_key_focus();
    }

    _moveFocusDown() {
        const keysPerRow = 10;
        this._currentFocusIndex = Math.min(this._focusableKeys.length - 1, this._currentFocusIndex + keysPerRow);
        this._focusableKeys[this._currentFocusIndex].grab_key_focus();
    }

    _clearFocus() {
        if (this._currentFocusIndex >= 0) {
            this._focusableKeys[this._currentFocusIndex].remove_style_class_name('betterkeys-key-focus');
        }
        this._currentFocusIndex = -1;
        this._keyboardUI.grab_key_focus();
    }

    _toggleStickyKey(keyval) {
        const keyName = this._keyvalToString(keyval);
        const currentlyActive = this._stickyKeys.get(keyName) || false;
        this._stickyKeys.set(keyName, !currentlyActive);

        // Visual feedback
        log(`[betterKeys] Sticky key ${keyName} ${!currentlyActive ? 'activated' : 'deactivated'}`);

        // Show indicator
        this._showStickyKeyIndicator(keyName, !currentlyActive);
    }

    _keyvalToString(keyval) {
        const map = {
            [Clutter.Shift_L]: 'Shift',
            [Clutter.Shift_R]: 'Shift',
            [Clutter.Control_L]: 'Ctrl',
            [Clutter.Control_R]: 'Ctrl',
            [Clutter.Alt_L]: 'Alt',
            [Clutter.Alt_R]: 'Alt',
            [Clutter.Super_L]: 'Super',
            [Clutter.Super_R]: 'Super'
        };
        return map[keyval] || 'Unknown';
    }

    _showStickyKeyIndicator(keyName, active) {
        // Create or update an indicator on the keyboard
        // This is a placeholder
        if (active) {
            log(`[betterKeys] Sticky key ${keyName} indicator shown`);
        } else {
            log(`[betterKeys] Sticky key ${keyName} indicator hidden`);
        }
    }

    _announceKey(label) {
        if (!this._screenReaderEnabled) return;

        // Use AT-SPI to announce the key label
        // This is a placeholder; actual implementation would use Atk.Object
        log(`[betterKeys] Screen reader announcement: ${label}`);
    }

    /**
     * Enable screen reader support.
     */
    enableScreenReaderSupport() {
        this._screenReaderEnabled = true;
        log('[betterKeys] Screen reader support enabled');
    }

    /**
     * Disable screen reader support.
     */
    disableScreenReaderSupport() {
        this._screenReaderEnabled = false;
        log('[betterKeys] Screen reader support disabled');
    }

    /**
     * Show a tooltip for a key.
     * @param {St.Widget} key - The key actor.
     * @param {string} text - Tooltip text.
     * @param {number} duration - Display duration in milliseconds.
     */
    showTooltip(key, text, duration = 2000) {
        // Create tooltip widget
        const tooltip = new St.Label({
            text: text,
            style_class: 'betterkeys-tooltip'
        });

        // Position above the key
        const [keyX, keyY] = key.get_transformed_position();
        tooltip.x = keyX + key.width / 2 - tooltip.width / 2;
        tooltip.y = keyY - tooltip.height - 5;

        // Add to stage
        _getMain().uiGroup.add_child(tooltip);

        // Remove after duration
        this._tooltipTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            _getMain().uiGroup.remove_child(tooltip);
            tooltip.destroy();
            this._tooltipTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Enable voice input placeholder.
     */
    enableVoiceInput() {
        this._voiceInputEnabled = true;
        this._applyVoiceInput();
        log('[betterKeys] Voice input placeholder enabled');
    }

    /**
     * Disable voice input.
     */
    disableVoiceInput() {
        this._voiceInputEnabled = false;
        this._applyVoiceInput();
        log('[betterKeys] Voice input disabled');
    }

    /**
     * Provide haptic feedback (if supported).
     */
    provideHapticFeedback() {
        // Placeholder for haptic feedback
        if (this._hapticFeedbackEnabled) {
            log('[betterKeys] Haptic feedback triggered');
        }
    }

    /**
     * Provide audio feedback (if enabled).
     * @param {string} type - Type of feedback ('focus', 'press', 'error', 'success').
     */
    provideAudioFeedback(type = 'press') {
        if (!this._audioFeedbackEnabled) return;

        // Placeholder for audio feedback
        log(`[betterKeys] Audio feedback (${type}) triggered`);
    }

    /**
     * Get accessibility status.
     * @returns {Object} Status object.
     */
    getStatus() {
        return {
            screenReader: this._screenReaderEnabled,
            highContrast: this._highContrastEnabled,
            largeKeys: this._largeKeysEnabled,
            slowMotion: this._slowMotionEnabled,
            focusRing: this._focusRingVisible,
            stickyKeys: this._stickyKeysEnabled,
            voiceInput: this._voiceInputEnabled,
            colorBlindMode: this._colorBlindMode,
            dyslexiaFont: this._dyslexiaFontEnabled,
            audioFeedback: this._audioFeedbackEnabled,
            hapticFeedback: this._hapticFeedbackEnabled
        };
    }

    /**
     * Reset all accessibility settings to defaults.
     */
    resetToDefaults() {
        this._highContrastEnabled = false;
        this._largeKeysEnabled = false;
        this._slowMotionEnabled = false;
        this._focusRingVisible = true;
        this._stickyKeysEnabled = false;
        this._voiceInputEnabled = false;
        this._colorBlindMode = 'none';
        this._dyslexiaFontEnabled = false;
        this._audioFeedbackEnabled = false;
        this._hapticFeedbackEnabled = false;

        // Apply changes
        this._applyHighContrast();
        this._applyLargeKeys();
        this._applySlowMotion();
        this._applyFocusRing();
        this._applyStickyKeys();
        this._applyVoiceInput();
        this._applyColorBlindMode();
        this._applyDyslexiaFont();

        log('[betterKeys] Accessibility settings reset to defaults');
    }

    destroy() {
        if (this._tooltipTimeoutId) {
            GLib.source_remove(this._tooltipTimeoutId);
            this._tooltipTimeoutId = 0;
        }

        if (this._keyRepeatTimeoutId) {
            GLib.source_remove(this._keyRepeatTimeoutId);
            this._keyRepeatTimeoutId = 0;
        }

        this._focusableKeys = [];
        this._stickyKeys.clear();

        log('[betterKeys] AccessibilityManager destroyed');
    }
});

// Add signals to the class
AccessibilityManager.signals = {
    'accessibility-changed': { param_types: [GObject.TYPE_STRING] },
    'screen-reader-toggled': { param_types: [GObject.TYPE_BOOLEAN] }
};

function _getMain() { return Main; }
