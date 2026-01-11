/* src/settings/manager.js - Settings management for betterKeys */

const { GObject, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

const SettingsManager = GObject.registerClass(
class SettingsManager extends GObject.Object {
    _init() {
        super._init();

        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.betterkeys');

        // Connect to settings changes
        this._settings.connect('changed', this._onSettingsChanged.bind(this));

        log('[betterKeys] SettingsManager initialized');
    }

    _onSettingsChanged(settings, key) {
        this.emit('changed', key);
    }

    // Getters for common settings
    getShowPredictionBar() {
        return this._settings.get_boolean('show-prediction-bar');
    }

    getAutoCorrectionEnabled() {
        return this._settings.get_boolean('auto-correction-enabled');
    }

    getHapticFeedbackEnabled() {
        return this._settings.get_boolean('haptic-feedback-enabled');
    }

    getKeyPressSoundEnabled() {
        return this._settings.get_boolean('key-press-sound-enabled');
    }

    getCurrentLayout() {
        return this._settings.get_string('current-layout');
    }

    getThemeName() {
        return this._settings.get_string('theme-name');
    }

    getApplicationLayouts() {
        return this._settings.get_value('application-layouts').deep_unpack();
    }

    // Setters for common settings
    setShowPredictionBar(value) {
        this._settings.set_boolean('show-prediction-bar', value);
    }

    setCurrentLayout(layoutId) {
        this._settings.set_string('current-layout', layoutId);
    }

    setThemeName(themeName) {
        this._settings.set_string('theme-name', themeName);
    }

    // Helper method to get all settings as an object
    getAllSettings() {
        return {
            showPredictionBar: this.getShowPredictionBar(),
            autoCorrectionEnabled: this.getAutoCorrectionEnabled(),
            hapticFeedbackEnabled: this.getHapticFeedbackEnabled(),
            keyPressSoundEnabled: this.getKeyPressSoundEnabled(),
            currentLayout: this.getCurrentLayout(),
            themeName: this.getThemeName(),
            applicationLayouts: this.getApplicationLayouts()
        };
    }

    // Method to update application-specific layout mapping
    setApplicationLayout(appId, layoutId) {
        let layouts = this.getApplicationLayouts();
        layouts[appId] = layoutId;
        this._settings.set_value('application-layouts', new GLib.Variant('a{ss}', layouts));
    }

    // Method to remove application-specific layout mapping
    removeApplicationLayout(appId) {
        let layouts = this.getApplicationLayouts();
        delete layouts[appId];
        this._settings.set_value('application-layouts', new GLib.Variant('a{ss}', layouts));
    }
});

// Add signals to the class
SettingsManager.signals = {
    'changed': { param_types: [GObject.TYPE_STRING] }
};

// Export the SettingsManager class (already defined as SettingsManager)
// var SettingsManager = SettingsManager; // Remove duplicate declaration
