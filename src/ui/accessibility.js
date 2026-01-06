/* src/ui/accessibility.js - Accessibility features for BetterKeys */

const { GObject, St, Clutter, Atk, Gio, GLib } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const BetterKeysAccessibilityManager = GObject.registerClass(
class BetterKeysAccessibilityManager extends GObject.Object {
    _init(settingsManager) {
        super._init();
        
        this._settings = settingsManager;
        this._keyboardUI = null;
        this._screenReaderEnabled = false;
        this._highContrastEnabled = false;
        this._largeKeysEnabled = false;
        this._slowMotionEnabled = false;
        this._focusRingVisible = true;
        this._tooltipTimeoutId = 0;
        this._currentFocusIndex = -1;
        this._focusableKeys = [];
        
        // Load settings
        this._loadSettings();
        
        // Connect to settings changes
        this._settings.connect('changed', this._onSettingsChanged.bind(this));
        
        // Detect screen reader
        this._detectScreenReader();
        
        log('[BetterKeys] AccessibilityManager initialized');
    }
    
    _loadSettings() {
        this._highContrastEnabled = this._settings.getBoolean('high-contrast-enabled');
        this._largeKeysEnabled = this._settings.getBoolean('large-keys-enabled');
        this._slowMotionEnabled = this._settings.getBoolean('slow-motion-enabled');
    }
    
    _detectScreenReader() {
        // Check if AT-SPI is active
        try {
            const tracker = Atk.Registry.get_default();
            this._screenReaderEnabled = tracker !== null;
        } catch (e) {
            this._screenReaderEnabled = false;
        }
        
        log(`[BetterKeys] Screen reader detected: ${this._screenReaderEnabled}`);
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
            this._keyboardUI.add_style_class_name('betterkeys-high-contrast');
        }
        
        // Apply large keys if enabled
        if (this._largeKeysEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-large-keys');
        }
        
        // Make all keys focusable for keyboard navigation
        this._setupKeyboardNavigation();
    }
    
    _applyHighContrast() {
        if (!this._keyboardUI) return;
        
        if (this._highContrastEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-high-contrast');
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-high-contrast');
        }
    }
    
    _applyLargeKeys() {
        if (!this._keyboardUI) return;
        
        if (this._largeKeysEnabled) {
            this._keyboardUI.add_style_class_name('betterkeys-large-keys');
            // Increase key sizes via CSS
        } else {
            this._keyboardUI.remove_style_class_name('betterkeys-large-keys');
        }
    }
    
    _applySlowMotion() {
        // Adjust animation speeds
        // This is a placeholder; would affect animation manager
        log(`[BetterKeys] Slow motion ${this._slowMotionEnabled ? 'enabled' : 'disabled'}`);
    }
    
    _setupKeyboardNavigation() {
        if (!this._keyboardUI) return;
        
        // Collect all key actors
        this._focusableKeys = this._keyboardUI._keys || [];
        
        // Set each key as focusable
        this._focusableKeys.forEach((key, index) => {
            key.can_focus = true;
            key.set_accessible_role(Atk.Role.PUSH_BUTTON);
            
            // Connect to focus events
            key.connect('notify::has-focus', this._onKeyFocusChanged.bind(this));
        });
        
        // Connect keyboard events for navigation
        this._keyboardUI.connect('key-press-event', this._onKeyboardNavigation.bind(this));
        
        log(`[BetterKeys] Keyboard navigation setup for ${this._focusableKeys.length} keys`);
    }
    
    _onKeyFocusChanged(key) {
        if (key.has_focus) {
            // Announce key label via screen reader
            this._announceKey(key.getLabel());
            
            // Show visual focus indicator
            key.add_style_class_name('betterkeys-key-focus');
        } else {
            key.remove_style_class_name('betterkeys-key-focus');
        }
    }
    
    _onKeyboardNavigation(actor, event) {
        const keyval = event.get_key_symbol();
        const state = event.get_state();
        
        // Handle Tab navigation
        if (keyval === Clutter.Tab && !state & Clutter.ModifierType.SHIFT_MASK) {
            this._moveFocusForward();
            return Clutter.EVENT_STOP;
        } else if (keyval === Clutter.Tab && state & Clutter.ModifierType.SHIFT_MASK) {
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
                }
                return Clutter.EVENT_STOP;
            case Clutter.Escape:
                // Exit keyboard navigation
                this._clearFocus();
                return Clutter.EVENT_STOP;
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
    
    _announceKey(label) {
        if (!this._screenReaderEnabled) return;
        
        // Use AT-SPI to announce the key label
        // This is a placeholder; actual implementation would use Atk.Object
        log(`[BetterKeys] Screen reader announcement: ${label}`);
    }
    
    /**
     * Enable screen reader support.
     */
    enableScreenReaderSupport() {
        this._screenReaderEnabled = true;
        log('[BetterKeys] Screen reader support enabled');
    }
    
    /**
     * Disable screen reader support.
     */
    disableScreenReaderSupport() {
        this._screenReaderEnabled = false;
        log('[BetterKeys] Screen reader support disabled');
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
        Main.uiGroup.add_child(tooltip);
        
        // Remove after duration
        this._tooltipTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            Main.uiGroup.remove_child(tooltip);
            tooltip.destroy();
            this._tooltipTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }
    
    /**
     * Enable voice input placeholder.
     */
    enableVoiceInput() {
        log('[BetterKeys] Voice input placeholder enabled');
        // This would integrate with speech‑to‑text services
    }
    
    /**
     * Disable voice input.
     */
    disableVoiceInput() {
        log('[BetterKeys] Voice input disabled');
    }
    
    /**
     * Provide haptic feedback (if supported).
     */
    provideHapticFeedback() {
        // Placeholder for haptic feedback
        log('[BetterKeys] Haptic feedback triggered');
    }
    
    /**
     * Provide audio feedback (if enabled).
     */
    provideAudioFeedback() {
        // Placeholder for audio feedback
        log('[BetterKeys] Audio feedback triggered');
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
            focusRing: this._focusRingVisible
        };
    }
    
    destroy() {
        if (this._tooltipTimeoutId) {
            GLib.source_remove(this._tooltipTimeoutId);
            this._tooltipTimeoutId = 0;
        }
        
        this._focusableKeys = [];
        
        log('[BetterKeys] AccessibilityManager destroyed');
    }
});

// Export the AccessibilityManager class
var AccessibilityManager = BetterKeysAccessibilityManager;
