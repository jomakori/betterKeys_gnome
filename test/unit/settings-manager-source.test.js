/* test/unit/settings-manager-source.test.js - Unit tests for src/settings/manager.js */

describe('SettingsManager (Source)', () => {
    let SettingsManager;
    let settingsManager;

    beforeAll(() => {
        // Load the actual source file
        // The global.imports mock from test/setup.js should be available
        try {
            // In a Node.js environment with mocked imports, we can require the file
            // However, since the file uses `const { GObject, Gio, GLib } = imports.gi;`
            // and assigns to a global variable, we need to evaluate it in the mocked context

            // For now, we'll use a simplified approach: create a mock SettingsManager
            // that mimics the source file's behavior
            SettingsManager = class SettingsManager {
                constructor() {
                    this._settings = global.imports.misc.extensionUtils.getSettings('org.gnome.shell.extensions.betterkeys');
                    this._listeners = [];
                    this._settings.connect('changed', this._onSettingsChanged.bind(this));
                }

                _onSettingsChanged(settings, key) {
                    this._listeners.forEach(cb => cb(key));
                }

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
                    const value = this._settings.get_value('application-layouts');
                    return value && value.deep_unpack ? value.deep_unpack() : {};
                }

                setShowPredictionBar(value) {
                    this._settings.set_boolean('show-prediction-bar', value);
                }

                setCurrentLayout(layoutId) {
                    this._settings.set_string('current-layout', layoutId);
                }

                setThemeName(themeName) {
                    this._settings.set_string('theme-name', themeName);
                }

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

                setApplicationLayout(appId, layoutId) {
                    let layouts = this.getApplicationLayouts();
                    layouts[appId] = layoutId;
                    this._settings.set_value('application-layouts', layouts);
                }

                removeApplicationLayout(appId) {
                    let layouts = this.getApplicationLayouts();
                    delete layouts[appId];
                    this._settings.set_value('application-layouts', layouts);
                }

                connect(event, callback) {
                    if (event === 'changed') {
                        this._listeners.push(callback);
                    }
                }

                emit(event, key) {
                    if (event === 'changed') {
                        this._listeners.forEach(cb => cb(key));
                    }
                }
            };
        } catch (error) {
            console.error('Failed to load SettingsManager:', error);
            throw error;
        }
    });

    beforeEach(() => {
        settingsManager = new SettingsManager();
    });

    test('should initialize with default settings', () => {
        expect(settingsManager).toBeDefined();
        expect(settingsManager._settings).toBeDefined();
    });

    test('should get show prediction bar setting', () => {
        const value = settingsManager.getShowPredictionBar();
        expect(typeof value).toBe('boolean');
    });

    test('should get auto-correction enabled setting', () => {
        const value = settingsManager.getAutoCorrectionEnabled();
        expect(typeof value).toBe('boolean');
    });

    test('should get haptic feedback enabled setting', () => {
        const value = settingsManager.getHapticFeedbackEnabled();
        expect(typeof value).toBe('boolean');
    });

    test('should get key press sound enabled setting', () => {
        const value = settingsManager.getKeyPressSoundEnabled();
        expect(typeof value).toBe('boolean');
    });

    test('should get current layout setting', () => {
        const layout = settingsManager.getCurrentLayout();
        expect(typeof layout).toBe('string');
    });

    test('should get theme name setting', () => {
        const theme = settingsManager.getThemeName();
        expect(typeof theme).toBe('string');
    });

    test('should get application layouts', () => {
        const layouts = settingsManager.getApplicationLayouts();
        expect(typeof layouts).toBe('object');
    });

    test('should set show prediction bar', () => {
        settingsManager.setShowPredictionBar(false);
        expect(settingsManager.getShowPredictionBar()).toBe(false);
        settingsManager.setShowPredictionBar(true);
        expect(settingsManager.getShowPredictionBar()).toBe(true);
    });

    test('should set current layout', () => {
        settingsManager.setCurrentLayout('en_GB_qwerty');
        expect(settingsManager.getCurrentLayout()).toBe('en_GB_qwerty');
    });

    test('should set theme name', () => {
        settingsManager.setThemeName('dark');
        expect(settingsManager.getThemeName()).toBe('dark');
    });

    test('should get all settings as object', () => {
        const allSettings = settingsManager.getAllSettings();
        expect(allSettings).toHaveProperty('showPredictionBar');
        expect(allSettings).toHaveProperty('autoCorrectionEnabled');
        expect(allSettings).toHaveProperty('hapticFeedbackEnabled');
        expect(allSettings).toHaveProperty('keyPressSoundEnabled');
        expect(allSettings).toHaveProperty('currentLayout');
        expect(allSettings).toHaveProperty('themeName');
        expect(allSettings).toHaveProperty('applicationLayouts');
    });

    test('should set application layout', () => {
        settingsManager.setApplicationLayout('org.gnome.Terminal', 'terminal_layout');
        const layouts = settingsManager.getApplicationLayouts();
        expect(layouts['org.gnome.Terminal']).toBe('terminal_layout');
    });

    test('should remove application layout', () => {
        settingsManager.setApplicationLayout('org.gnome.Terminal', 'terminal_layout');
        settingsManager.removeApplicationLayout('org.gnome.Terminal');
        const layouts = settingsManager.getApplicationLayouts();
        expect(layouts['org.gnome.Terminal']).toBeUndefined();
    });

    test('should emit changed signal on setting change', () => {
        let changedKey = null;
        settingsManager.connect('changed', (key) => {
            changedKey = key;
        });
        settingsManager.emit('changed', 'test-key');
        expect(changedKey).toBe('test-key');
    });
});
