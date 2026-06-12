/* src/ui/key.js - Individual key component */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Atk from 'gi://Atk';

function _(str) { return str; }

export const Key = GObject.registerClass(
class Key extends St.Button {
    _init(label, width = 60, height = 60) {
        super._init({
            reactive: true,
            can_focus: true,
            style_class: 'betterkeys-key',
            width: width,
            height: height,
            label: label
        });

        this._label = label;
        this._isPressed = false;
        this._isHeld = false;
        this._theme = 'default';
        this._icon = null;
        this._longPressTimeoutId = 0;
        this._isDisabled = false;
        this._modifierState = 'none'; // 'shift', 'ctrl', 'alt', 'super', 'none'
        this._accessibilityLabel = this._computeAccessibilityLabel(label);

        // Create icon if needed
        this._createIcon();

        // Connect to button events
        this.connect('button-press-event', this._onButtonPress.bind(this));
        this.connect('button-release-event', this._onButtonRelease.bind(this));
        this.connect('enter-event', this._onEnter.bind(this));
        this.connect('leave-event', this._onLeave.bind(this));
        this.connect('long-press', this._onLongPress.bind(this));

        // Apply initial theme
        this._applyTheme();

        // Set accessibility attributes
        this._updateAccessibility();
    }

    _computeAccessibilityLabel(label) {
        // Map special keys to descriptive labels
        const mapping = {
            'Space': _('Space'),
            'Enter': _('Enter'),
            'Backspace': _('Backspace'),
            'Shift': _('Shift'),
            '?123': _('Symbols'),
            'Ctrl': _('Control'),
            'Alt': _('Alt'),
            'Super': _('Super'),
            'Tab': _('Tab'),
            'Caps': _('Caps Lock'),
            'Esc': _('Escape'),
        };
        return mapping[label] || label;
    }

    _createIcon() {
        // Determine if this key should have an icon
        let iconName = null;
        switch (this._label) {
            case 'Backspace':
                iconName = 'edit-delete-symbolic';
                break;
            case 'Enter':
                iconName = 'go-next-symbolic';
                break;
            case 'Shift':
                iconName = 'shift-symbolic';
                break;
            case '?123':
                iconName = 'input-keyboard-symbolic';
                break;
            case 'Space':
                iconName = 'space-bar-symbolic';
                break;
        }

        if (iconName) {
            // Remove text label
            this.set_label('');

            this._icon = new St.Icon({
                icon_name: iconName,
                icon_size: 24,
                style_class: 'betterkeys-key-icon'
            });
            this.add_child(this._icon);
        }
    }

    _onButtonPress(_actor, _event) {
        if (this._isDisabled) return Clutter.EVENT_PROPAGATE;

        this._isPressed = true;
        this.add_style_class_name('betterkeys-key-pressed');

        // Start long-press detection (500ms)
        this._longPressTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
            this.emit('long-press', this._label);
            this._longPressTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });

        // Emit the pressed signal
        this.emit('pressed', this._label);

        return Clutter.EVENT_STOP;
    }

    _onButtonRelease(_actor, _event) {
        if (this._longPressTimeoutId) {
            GLib.source_remove(this._longPressTimeoutId);
            this._longPressTimeoutId = 0;
        }

        this._isPressed = false;
        this.remove_style_class_name('betterkeys-key-pressed');

        // If key was held, remove held class
        if (this._isHeld) {
            this._isHeld = false;
            this.remove_style_class_name('betterkeys-key-held');
        }

        return Clutter.EVENT_STOP;
    }

    _onLongPress(actor, label) {
        this._isHeld = true;
        this.add_style_class_name('betterkeys-key-held');
        log(`[betterKeys] Key long-pressed: ${label}`);
    }

    _onEnter(_actor, _event) {
        if (this._isDisabled) return Clutter.EVENT_PROPAGATE;

        this.add_style_class_name('betterkeys-key-hover');
        return Clutter.EVENT_PROPAGATE;
    }

    _onLeave(_actor, _event) {
        this.remove_style_class_name('betterkeys-key-hover');
        return Clutter.EVENT_PROPAGATE;
    }

    _applyTheme() {
        // Remove existing theme classes
        this.remove_style_class_name('betterkeys-key-default');
        this.remove_style_class_name('betterkeys-key-dark');
        this.remove_style_class_name('betterkeys-key-high-contrast');

        // Add theme class based on current theme
        this.add_style_class_name(`betterkeys-key-${this._theme}`);

        // Apply special styling for certain key types
        this._applySpecialStyling();
    }

    _applySpecialStyling() {
        // Remove any special styling classes
        this.remove_style_class_name('betterkeys-key-special');
        this.remove_style_class_name('betterkeys-key-space');
        this.remove_style_class_name('betterkeys-key-enter');
        this.remove_style_class_name('betterkeys-key-backspace');
        this.remove_style_class_name('betterkeys-key-shift');
        this.remove_style_class_name('betterkeys-key-symbol');
        this.remove_style_class_name('betterkeys-key-modifier');
        this.remove_style_class_name('betterkeys-key-disabled');

        // Apply special styling based on key type
        switch (this._label) {
            case 'Space':
                this.add_style_class_name('betterkeys-key-space');
                break;
            case 'Enter':
                this.add_style_class_name('betterkeys-key-enter');
                break;
            case 'Backspace':
                this.add_style_class_name('betterkeys-key-backspace');
                break;
            case 'Shift':
            case 'Ctrl':
            case 'Alt':
            case 'Super':
                this.add_style_class_name('betterkeys-key-modifier');
                break;
            case '?123':
                this.add_style_class_name('betterkeys-key-symbol');
                break;
            default:
                if (this._label.length > 1) {
                    this.add_style_class_name('betterkeys-key-special');
                }
                break;
        }

        // Disabled state
        if (this._isDisabled) {
            this.add_style_class_name('betterkeys-key-disabled');
        }
    }

    _updateAccessibility() {
        // Set accessibility attributes for screen readers
        this.set_accessible_name(this._accessibilityLabel);
        this.set_accessible_description(this._label);
        this.set_accessible_role(Atk.Role.PUSH_BUTTON);
    }

    setTheme(themeName) {
        if (this._theme !== themeName) {
            this._theme = themeName;
            this._applyTheme();
        }
    }

    getLabel() {
        return this._label;
    }

    setLabel(newLabel) {
        this._label = newLabel;
        this.set_label(newLabel);
        this._applySpecialStyling();
        this._accessibilityLabel = this._computeAccessibilityLabel(newLabel);
        this._updateAccessibility();
    }

    isPressed() {
        return this._isPressed;
    }

    setModifierState(state) {
        const validStates = ['none', 'shift', 'ctrl', 'alt', 'super'];
        if (!validStates.includes(state)) {
            logError(`[betterKeys] Invalid modifier state: ${state}`);
            return;
        }

        this._modifierState = state;

        // Update visual indication
        this.remove_style_class_name('betterkeys-key-modifier-active');
        if (state !== 'none') {
            this.add_style_class_name('betterkeys-key-modifier-active');
        }
    }

    setDisabled(disabled) {
        if (this._isDisabled === disabled) return;

        this._isDisabled = disabled;
        this.can_focus = !disabled;
        this.reactive = !disabled;

        if (disabled) {
            this.add_style_class_name('betterkeys-key-disabled');
        } else {
            this.remove_style_class_name('betterkeys-key-disabled');
        }
    }

    resize(width, height) {
        this.width = width;
        this.height = height;

        // Adjust icon size proportionally
        if (this._icon) {
            const iconSize = Math.min(width, height) * 0.5;
            this._icon.icon_size = iconSize;
        }
    }

    destroy() {
        if (this._longPressTimeoutId) {
            GLib.source_remove(this._longPressTimeoutId);
            this._longPressTimeoutId = 0;
        }
        super.destroy();
    }
});

// Add signals to the class
Key.signals = {
    'pressed': { param_types: [GObject.TYPE_STRING] },
    'long-press': { param_types: [GObject.TYPE_STRING] }
};
