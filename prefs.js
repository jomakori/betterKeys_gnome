/* prefs.js - Preferences UI for betterKeys Virtual Keyboard */

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource://org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class betterKeysPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.betterkeys');
        const page = new betterKeysPrefsWidget({ settings });
        window.add(page);
    }
}

const betterKeysPrefsWidget = GObject.registerClass(
class betterKeysPrefsWidget extends Gtk.ScrolledWindow {
    constructor(params) {
        // Extract settings before calling super
        let settings = params.settings;
        // Create a copy of params without settings to avoid GObject property error
        let filteredParams = Object.assign({}, params);
        delete filteredParams.settings;
        super(filteredParams);
        this._settings = settings;
        this.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12
        });

        this.set_child(box);
        this._buildUI(box);
    }

    _buildUI(box) {
        // Header
        let headerLabel = new Gtk.Label({
            label: '<span size="x-large" weight="bold">betterKeys Virtual Keyboard</span>',
            use_markup: true,
            halign: Gtk.Align.START
        });
        box.append(headerLabel);

        // Separator
        let separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL
        });
        box.append(separator);

        // Basic Settings Section
        let basicFrame = this._createSectionFrame('Basic Settings');
        let basicBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        basicFrame.set_child(basicBox);

        // Show prediction bar
        let predictionSwitch = this._createSwitchSetting(
            'Show prediction bar',
            'show-prediction-bar',
            'Display word predictions above the keyboard'
        );
        basicBox.append(predictionSwitch);

        // Auto-correction
        let autocorrectSwitch = this._createSwitchSetting(
            'Enable auto-correction',
            'auto-correction-enabled',
            'Automatically correct misspelled words'
        );
        basicBox.append(autocorrectSwitch);

        // Haptic feedback
        let hapticSwitch = this._createSwitchSetting(
            'Haptic feedback',
            'haptic-feedback-enabled',
            'Provide vibration feedback on key press'
        );
        basicBox.append(hapticSwitch);

        // Key press sound
        let soundSwitch = this._createSwitchSetting(
            'Key press sound',
            'key-press-sound-enabled',
            'Play sound on key press'
        );
        basicBox.append(soundSwitch);

        // Gesture swipe
        let gestureSwitch = this._createSwitchSetting(
            'Enable swipe gestures',
            'gesture-swipe-enabled',
            'Use swipe gestures for navigation and editing'
        );
        basicBox.append(gestureSwitch);

        // Glide typing
        let glideSwitch = this._createSwitchSetting(
            'Enable glide typing',
            'glide-typing-enabled',
            'Swipe across keys to type words'
        );
        basicBox.append(glideSwitch);

        box.append(basicFrame);

        // Layout Settings Section
        let layoutFrame = this._createSectionFrame('Layout Settings');
        let layoutBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        layoutFrame.set_child(layoutBox);

        // Current layout selection
        let layoutLabel = new Gtk.Label({
            label: 'Default Layout:',
            halign: Gtk.Align.START
        });
        layoutBox.append(layoutLabel);

        let layoutCombo = new Gtk.ComboBoxText();
        layoutCombo.append('en_US_qwerty', 'English (US) QWERTY');
        layoutCombo.append('en_GB_qwerty', 'English (UK) QWERTY');
        layoutCombo.append('fr_FR_azerty', 'French AZERTY');
        layoutCombo.set_active_id(this._settings.get_string('current-layout'));

        layoutCombo.connect('changed', (widget) => {
            let layoutId = widget.get_active_id();
            if (layoutId) {
                this._settings.set_string('current-layout', layoutId);
            }
        });

        layoutBox.append(layoutCombo);

        box.append(layoutFrame);

        // Theme Settings Section
        let themeFrame = this._createSectionFrame('Theme');
        let themeBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        themeFrame.set_child(themeBox);

        let themeLabel = new Gtk.Label({
            label: 'Theme:',
            halign: Gtk.Align.START
        });
        themeBox.append(themeLabel);

        let themeCombo = new Gtk.ComboBoxText();
        themeCombo.append('light', 'Light');
        themeCombo.append('dark', 'Dark');
        themeCombo.append('high-contrast', 'High Contrast');
        themeCombo.append('solarized', 'Solarized');
        themeCombo.append('nord', 'Nord');
        themeCombo.append('gruvbox', 'Gruvbox');
        themeCombo.set_active_id(this._settings.get_string('theme-name'));

        themeCombo.connect('changed', (widget) => {
            let themeId = widget.get_active_id();
            if (themeId) {
                this._settings.set_string('theme-name', themeId);
            }
        });

        themeBox.append(themeCombo);

        let autoThemeSwitch = this._createSwitchSetting(
            'Follow system dark/light theme',
            'theme-auto-dark-light',
            'Automatically switch between light and dark themes based on system preference'
        );
        themeBox.append(autoThemeSwitch);

        box.append(themeFrame);

        // Keyboard Size Section
        let sizeFrame = this._createSectionFrame('Keyboard Size');
        let sizeBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        sizeFrame.set_child(sizeBox);

        let sizeLabel = new Gtk.Label({
            label: 'Size:',
            halign: Gtk.Align.START
        });
        sizeBox.append(sizeLabel);

        let sizeCombo = new Gtk.ComboBoxText();
        sizeCombo.append('compact', 'Compact');
        sizeCombo.append('normal', 'Normal');
        sizeCombo.append('large', 'Large');
        sizeCombo.set_active_id(this._settings.get_string('keyboard-size') || 'normal');

        sizeCombo.connect('changed', (widget) => {
            let sizeId = widget.get_active_id();
            if (sizeId) {
                this._settings.set_string('keyboard-size', sizeId);
            }
        });

        sizeBox.append(sizeCombo);

        box.append(sizeFrame);

        // Docking Position Section
        let dockingFrame = this._createSectionFrame('Docking Position');
        let dockingBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        dockingFrame.set_child(dockingBox);

        let dockingLabel = new Gtk.Label({
            label: 'Position:',
            halign: Gtk.Align.START
        });
        dockingBox.append(dockingLabel);

        let dockingCombo = new Gtk.ComboBoxText();
        dockingCombo.append('bottom', 'Bottom');
        dockingCombo.append('top', 'Top');
        dockingCombo.append('left', 'Left');
        dockingCombo.append('right', 'Right');
        dockingCombo.append('floating', 'Floating');
        dockingCombo.set_active_id(this._settings.get_string('docking-position') || 'bottom');

        dockingCombo.connect('changed', (widget) => {
            let posId = widget.get_active_id();
            if (posId) {
                this._settings.set_string('docking-position', posId);
            }
        });

        dockingBox.append(dockingCombo);

        box.append(dockingFrame);

        // Visibility Behavior Section
        let visibilityFrame = this._createSectionFrame('Visibility Behavior');
        let visibilityBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        visibilityFrame.set_child(visibilityBox);

        let autoShowSwitch = this._createSwitchSetting(
            'Auto-show on text focus',
            'auto-show-enabled',
            'Automatically show keyboard when a text field is focused'
        );
        visibilityBox.append(autoShowSwitch);

        let autoHideSwitch = this._createSwitchSetting(
            'Auto-hide on blur',
            'auto-hide-enabled',
            'Automatically hide keyboard when text field loses focus'
        );
        visibilityBox.append(autoHideSwitch);

        box.append(visibilityFrame);

        // Accessibility Section
        let accessibilityFrame = this._createSectionFrame('Accessibility');
        let accessibilityBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        accessibilityFrame.set_child(accessibilityBox);

        let highContrastSwitch = this._createSwitchSetting(
            'High contrast mode',
            'high-contrast-enabled',
            'Increase color contrast for better visibility'
        );
        accessibilityBox.append(highContrastSwitch);

        let largeKeysSwitch = this._createSwitchSetting(
            'Large keys',
            'large-keys-enabled',
            'Increase key size for easier targeting'
        );
        accessibilityBox.append(largeKeysSwitch);

        let slowMotionSwitch = this._createSwitchSetting(
            'Slow motion animations',
            'slow-motion-enabled',
            'Slow down animations for better visibility'
        );
        accessibilityBox.append(slowMotionSwitch);

        box.append(accessibilityFrame);

        // Info label
        let infoLabel = new Gtk.Label({
            label: 'Changes will take effect when the keyboard is next shown.',
            halign: Gtk.Align.START,
            wrap: true
        });
        box.append(infoLabel);
    }

    _createSectionFrame(title) {
        let frame = new Gtk.Frame({
            margin_top: 8
        });

        let label = new Gtk.Label({
            label: `<b>${title}</b>`,
            use_markup: true,
            halign: Gtk.Align.START,
            margin_start: 6,
            margin_top: 6,
            margin_bottom: 6
        });

        frame.set_label_widget(label);
        return frame;
    }

    _createSwitchSetting(labelText, settingKey, tooltip) {
        let box = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12
        });

        let label = new Gtk.Label({
            label: labelText,
            halign: Gtk.Align.START,
            hexpand: true
        });
        box.append(label);

        let switchWidget = new Gtk.Switch({
            active: this._settings.get_boolean(settingKey),
            halign: Gtk.Align.END
        });

        if (tooltip) {
            switchWidget.set_tooltip_text(tooltip);
        }

        switchWidget.connect('notify::active', (widget) => {
            this._settings.set_boolean(settingKey, widget.active);
        });

        box.append(switchWidget);
        return box;
    }
});
