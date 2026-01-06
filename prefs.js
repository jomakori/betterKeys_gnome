/* prefs.js - Preferences UI for BetterKeys Virtual Keyboard */

const { GObject, Gtk, Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function init() {
    log(`[BetterKeys Prefs] Initializing preferences`);
}

function buildPrefsWidget() {
    let widget = new BetterKeysPrefsWidget();
    return widget;
}

const BetterKeysPrefsWidget = GObject.registerClass(
class BetterKeysPrefsWidget extends Gtk.Box {
    _init(params) {
        super._init(params);
        
        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.betterkeys');
        
        this.set_orientation(Gtk.Orientation.VERTICAL);
        this.set_spacing(12);
        this.set_margin_start(12);
        this.set_margin_end(12);
        this.set_margin_top(12);
        this.set_margin_bottom(12);
        
        this._buildUI();
    }
    
    _buildUI() {
        // Header
        let headerLabel = new Gtk.Label({
            label: '<span size="x-large" weight="bold">BetterKeys Virtual Keyboard</span>',
            use_markup: true,
            halign: Gtk.Align.START
        });
        this.append(headerLabel);
        
        // Separator
        let separator = new Gtk.Separator({
            orientation: Gtk.Orientation.HORIZONTAL
        });
        this.append(separator);
        
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
        
        this.append(basicFrame);
        
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
        
        this.append(layoutFrame);
        
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
        themeCombo.append('default', 'Default');
        themeCombo.append('dark', 'Dark');
        themeCombo.append('high-contrast', 'High Contrast');
        themeCombo.set_active_id(this._settings.get_string('theme-name'));
        
        themeCombo.connect('changed', (widget) => {
            let themeId = widget.get_active_id();
            if (themeId) {
                this._settings.set_string('theme-name', themeId);
            }
        });
        
        themeBox.append(themeCombo);
        
        this.append(themeFrame);
        
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
        
        this.append(sizeFrame);
        
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
        
        this.append(dockingFrame);
        
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
        
        this.append(visibilityFrame);
        
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
        
        this.append(accessibilityFrame);
        
        // Gesture Settings Section
        let gestureFrame = this._createSectionFrame('Gesture Settings');
        let gestureBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        gestureFrame.set_child(gestureBox);
        
        let gestureSensitivityLabel = new Gtk.Label({
            label: 'Gesture sensitivity:',
            halign: Gtk.Align.START
        });
        gestureBox.append(gestureSensitivityLabel);
        
        let gestureSensitivityScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                value: this._settings.get_int('gesture-sensitivity'),
                lower: 0,
                upper: 100,
                step_increment: 5,
                page_increment: 10
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT
        });
        gestureSensitivityScale.connect('value-changed', (widget) => {
            this._settings.set_int('gesture-sensitivity', widget.get_value());
        });
        gestureBox.append(gestureSensitivityScale);
        
        let gestureVisualizationSwitch = this._createSwitchSetting(
            'Show gesture visualization',
            'gesture-visualization',
            'Display visual feedback for swipe and glide gestures'
        );
        gestureBox.append(gestureVisualizationSwitch);
        
        this.append(gestureFrame);
        
        // Prediction Settings Section
        let predictionFrame = this._createSectionFrame('Prediction Settings');
        let predictionBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        predictionFrame.set_child(predictionBox);
        
        let suggestionCountLabel = new Gtk.Label({
            label: 'Number of suggestions:',
            halign: Gtk.Align.START
        });
        predictionBox.append(suggestionCountLabel);
        
        let suggestionCountCombo = new Gtk.ComboBoxText();
        suggestionCountCombo.append('1', '1');
        suggestionCountCombo.append('2', '2');
        suggestionCountCombo.append('3', '3');
        suggestionCountCombo.append('4', '4');
        suggestionCountCombo.append('5', '5');
        suggestionCountCombo.set_active_id(this._settings.get_int('suggestion-count').toString());
        
        suggestionCountCombo.connect('changed', (widget) => {
            let count = widget.get_active_id();
            if (count) {
                this._settings.set_int('suggestion-count', parseInt(count));
            }
        });
        predictionBox.append(suggestionCountCombo);
        
        let vocabularyLearningSwitch = this._createSwitchSetting(
            'Learn new words',
            'vocabulary-learning',
            'Learn new words from your typing to improve predictions'
        );
        predictionBox.append(vocabularyLearningSwitch);
        
        this.append(predictionFrame);
        
        // Machine Learning Settings Section
        let mlFrame = this._createSectionFrame('Machine Learning');
        let mlBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        mlFrame.set_child(mlBox);
        
        let mlLearningSwitch = this._createSwitchSetting(
            'Enable ML learning',
            'ml-learning-enabled',
            'Use machine learning to personalize predictions based on your typing patterns'
        );
        mlBox.append(mlLearningSwitch);
        
        this.append(mlFrame);
        
        // Layout Adaptation Section
        let layoutAdaptFrame = this._createSectionFrame('Layout Adaptation');
        let layoutAdaptBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        layoutAdaptFrame.set_child(layoutAdaptBox);
        
        let layoutAutoSwitchSwitch = this._createSwitchSetting(
            'Auto-switch layouts',
            'layout-auto-switch',
            'Automatically switch keyboard layout based on active application'
        );
        layoutAdaptBox.append(layoutAutoSwitchSwitch);
        
        let layoutIndicatorSwitch = this._createSwitchSetting(
            'Show layout indicator',
            'show-layout-indicator',
            'Display current layout indicator on the keyboard'
        );
        layoutAdaptBox.append(layoutIndicatorSwitch);
        
        let layoutPreviewSwitch = this._createSwitchSetting(
            'Layout preview on hover',
            'layout-preview-on-hover',
            'Show layout preview when hovering over layout indicator'
        );
        layoutAdaptBox.append(layoutPreviewSwitch);
        
        this.append(layoutAdaptFrame);
        
        // Performance Settings Section
        let performanceFrame = this._createSectionFrame('Performance');
        let performanceBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        performanceFrame.set_child(performanceBox);
        
        let cacheSizeLabel = new Gtk.Label({
            label: 'Prediction cache size:',
            halign: Gtk.Align.START
        });
        performanceBox.append(cacheSizeLabel);
        
        let cacheSizeCombo = new Gtk.ComboBoxText();
        cacheSizeCombo.append('500', '500 predictions');
        cacheSizeCombo.append('1000', '1000 predictions');
        cacheSizeCombo.append('2000', '2000 predictions');
        cacheSizeCombo.append('5000', '5000 predictions');
        cacheSizeCombo.set_active_id(this._settings.get_int('prediction-cache-size').toString());
        
        cacheSizeCombo.connect('changed', (widget) => {
            let size = widget.get_active_id();
            if (size) {
                this._settings.set_int('prediction-cache-size', parseInt(size));
            }
        });
        performanceBox.append(cacheSizeCombo);
        
        this.append(performanceFrame);
        
        // Advanced Settings Section
        let advancedFrame = this._createSectionFrame('Advanced');
        let advancedBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8
        });
        advancedFrame.set_child(advancedBox);
        
        // Keyboard height scale
        let heightLabel = new Gtk.Label({
            label: 'Keyboard height:',
            halign: Gtk.Align.START
        });
        advancedBox.append(heightLabel);
        
        let heightScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                value: this._settings.get_int('keyboard-height'),
                lower: 100,
                upper: 800,
                step_increment: 10,
                page_increment: 50
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT
        });
        heightScale.connect('value-changed', (widget) => {
            this._settings.set_int('keyboard-height', widget.get_value());
        });
        advancedBox.append(heightScale);
        
        // Keyboard opacity scale
        let opacityLabel = new Gtk.Label({
            label: 'Keyboard opacity:',
            halign: Gtk.Align.START
        });
        advancedBox.append(opacityLabel);
        
        let opacityScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({
                value: this._settings.get_double('keyboard-opacity') * 100,
                lower: 10,
                upper: 100,
                step_increment: 5,
                page_increment: 10
            }),
            draw_value: true,
            value_pos: Gtk.PositionType.RIGHT
        });
        opacityScale.connect('value-changed', (widget) => {
            this._settings.set_double('keyboard-opacity', widget.get_value() / 100.0);
        });
        advancedBox.append(opacityScale);
        
        this.append(advancedFrame);
        
        // Info label
        let infoLabel = new Gtk.Label({
            label: 'Changes will take effect when the keyboard is next shown.',
            halign: Gtk.Align.START,
            wrap: true
        });
        this.append(infoLabel);
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

// Helper logging function
function log(message) {
    global.log(message);
}
