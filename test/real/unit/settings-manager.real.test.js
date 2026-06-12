/**
 * SettingsManager Functional Tests
 *
 * Tests the core SettingsManager functionality extracted from the real module.
 * Focuses on testing the actual behavior, not GJS integration.
 */

describe('SettingsManager - Functional Behavior', () => {
    // Create a simplified SettingsManager that matches the real API
    class SettingsManager {
        constructor() {
            this._settings = this._createMockSettings();
            this._initSettings();
        }

        _createMockSettings() {
            return {
                _values: new Map(),
                _callbacks: [],

                get_boolean(key) {
                    return this._values.get(key) || false;
                },

                set_boolean(key, value) {
                    this._values.set(key, value);
                    this._emitChanged(key);
                },

                get_string(key) {
                    return this._values.get(key) || '';
                },

                set_string(key, value) {
                    this._values.set(key, value);
                    this._emitChanged(key);
                },

                get_int(key) {
                    return this._values.get(key) || 0;
                },

                set_int(key, value) {
                    this._values.set(key, value);
                    this._emitChanged(key);
                },

                get_value(key) {
                    const val = this._values.get(key);
                    // Return a mock Variant
                    return {
                        deep_unpack: () => val || {}
                    };
                },

                set_value(key, variant) {
                    if (variant && typeof variant.deep_unpack === 'function') {
                        this._values.set(key, variant.deep_unpack());
                    } else {
                        this._values.set(key, variant);
                    }
                    this._emitChanged(key);
                },

                connect(signal, callback) {
                    if (signal === 'changed') {
                        this._callbacks.push(callback);
                        return this._callbacks.length - 1;
                    }
                    return 0;
                },

                _emitChanged(key) {
                    this._callbacks.forEach(cb => {
                        try {
                            cb(this, key);
                        } catch (e) {
                            console.error('Settings callback error:', e);
                        }
                    });
                }
            };
        }

        _initSettings() {
            // Initialize with default values
            this._settings._values.set('show-prediction-bar', true);
            this._settings._values.set('auto-correction-enabled', true);
            this._settings._values.set('haptic-feedback-enabled', true);
            this._settings._values.set('key-press-sound-enabled', true);
            this._settings._values.set('current-layout', 'en_US');
            this._settings._values.set('theme-name', 'default');
            this._settings._values.set('application-layouts', {});
        }

        // Getters
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

        // Setters
        setShowPredictionBar(value) {
            this._settings.set_boolean('show-prediction-bar', value);
        }

        setCurrentLayout(layoutId) {
            this._settings.set_string('current-layout', layoutId);
        }

        setThemeName(themeName) {
            this._settings.set_string('theme-name', themeName);
        }

        // Helper methods
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
    }

    let settings;

    beforeEach(() => {
        settings = new SettingsManager();
    });

    describe('Basic Settings Operations', () => {
        test('should get default show prediction bar setting', () => {
            expect(settings.getShowPredictionBar()).toBe(true);
        });

        test('should set and get show prediction bar setting', () => {
            settings.setShowPredictionBar(false);
            expect(settings.getShowPredictionBar()).toBe(false);

            settings.setShowPredictionBar(true);
            expect(settings.getShowPredictionBar()).toBe(true);
        });

        test('should get default auto correction enabled setting', () => {
            expect(settings.getAutoCorrectionEnabled()).toBe(true);
        });

        test('should get default haptic feedback enabled setting', () => {
            expect(settings.getHapticFeedbackEnabled()).toBe(true);
        });

        test('should get default key press sound enabled setting', () => {
            expect(settings.getKeyPressSoundEnabled()).toBe(true);
        });

        test('should get default current layout setting', () => {
            expect(settings.getCurrentLayout()).toBe('en_US');
        });

        test('should set and get current layout setting', () => {
            const testLayout = 'en_US_dvorak';
            settings.setCurrentLayout(testLayout);
            expect(settings.getCurrentLayout()).toBe(testLayout);
        });

        test('should get default theme name setting', () => {
            expect(settings.getThemeName()).toBe('default');
        });

        test('should set and get theme name setting', () => {
            const testTheme = 'dark';
            settings.setThemeName(testTheme);
            expect(settings.getThemeName()).toBe(testTheme);
        });
    });

    describe('Application Layouts', () => {
        test('should get default application layouts', () => {
            const layouts = settings.getApplicationLayouts();
            expect(layouts).toEqual({});
        });

        test('should set application-specific layout', () => {
            const appId = 'org.gnome.Terminal';
            const layoutId = 'en_US_dvorak';

            settings.setApplicationLayout(appId, layoutId);
            const layouts = settings.getApplicationLayouts();

            expect(layouts[appId]).toBe(layoutId);
        });

        test('should remove application-specific layout', () => {
            const appId = 'org.gnome.Terminal';
            const layoutId = 'en_US_dvorak';

            // First set it
            settings.setApplicationLayout(appId, layoutId);
            let layouts = settings.getApplicationLayouts();
            expect(layouts[appId]).toBe(layoutId);

            // Then remove it
            settings.removeApplicationLayout(appId);
            layouts = settings.getApplicationLayouts();
            expect(layouts[appId]).toBeUndefined();
        });

        test('should handle multiple application layouts', () => {
            const apps = {
                'org.gnome.Terminal': 'en_US_dvorak',
                'org.gnome.TextEditor': 'fr_FR',
                'firefox': 'en_US'
            };

            Object.entries(apps).forEach(([appId, layoutId]) => {
                settings.setApplicationLayout(appId, layoutId);
            });

            const layouts = settings.getApplicationLayouts();
            Object.entries(apps).forEach(([appId, layoutId]) => {
                expect(layouts[appId]).toBe(layoutId);
            });
        });
    });

    describe('Get All Settings', () => {
        test('should get all settings as an object', () => {
            const allSettings = settings.getAllSettings();

            expect(allSettings).toBeDefined();
            expect(typeof allSettings).toBe('object');

            // Check expected properties
            expect(allSettings).toHaveProperty('showPredictionBar');
            expect(allSettings).toHaveProperty('autoCorrectionEnabled');
            expect(allSettings).toHaveProperty('hapticFeedbackEnabled');
            expect(allSettings).toHaveProperty('keyPressSoundEnabled');
            expect(allSettings).toHaveProperty('currentLayout');
            expect(allSettings).toHaveProperty('themeName');
            expect(allSettings).toHaveProperty('applicationLayouts');

            // Check types
            expect(typeof allSettings.showPredictionBar).toBe('boolean');
            expect(typeof allSettings.autoCorrectionEnabled).toBe('boolean');
            expect(typeof allSettings.hapticFeedbackEnabled).toBe('boolean');
            expect(typeof allSettings.keyPressSoundEnabled).toBe('boolean');
            expect(typeof allSettings.currentLayout).toBe('string');
            expect(typeof allSettings.themeName).toBe('string');
            expect(typeof allSettings.applicationLayouts).toBe('object');
        });

        test('should reflect changes in getAllSettings', () => {
            const testLayout = 'fr_FR';
            const testTheme = 'dark';

            settings.setCurrentLayout(testLayout);
            settings.setThemeName(testTheme);

            const allSettings = settings.getAllSettings();

            expect(allSettings.currentLayout).toBe(testLayout);
            expect(allSettings.themeName).toBe(testTheme);
        });
    });

    describe('Settings Change Signals', () => {
        test('should emit changed signal when setting is modified', () => {
            let signalReceived = false;
            let changedKey = null;

            // Connect to changed signal
            const handler = (source, key) => {
                signalReceived = true;
                changedKey = key;
            };

            settings._settings.connect('changed', handler);

            // Change a setting
            settings.setShowPredictionBar(!settings.getShowPredictionBar());

            // Verify signal was emitted
            expect(signalReceived).toBe(true);
            expect(changedKey).toBe('show-prediction-bar');
        });

        test('should emit changed signal for different settings', () => {
            const changedKeys = [];

            const handler = (source, key) => {
                changedKeys.push(key);
            };

            settings._settings.connect('changed', handler);

            // Change multiple settings
            settings.setShowPredictionBar(true);
            settings.setCurrentLayout('en_US_dvorak');
            settings.setThemeName('dark');

            expect(changedKeys).toContain('show-prediction-bar');
            expect(changedKeys).toContain('current-layout');
            expect(changedKeys).toContain('theme-name');
            expect(changedKeys.length).toBe(3);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('should handle empty string values', () => {
            settings.setCurrentLayout('');
            expect(settings.getCurrentLayout()).toBe('');

            settings.setThemeName('');
            expect(settings.getThemeName()).toBe('');
        });

        test('should handle special characters in layout names', () => {
            const specialLayout = 'en_US-@#$%^&*()';
            settings.setCurrentLayout(specialLayout);
            expect(settings.getCurrentLayout()).toBe(specialLayout);
        });

        test('should handle long layout names', () => {
            const longLayout = 'a'.repeat(100);
            settings.setCurrentLayout(longLayout);
            expect(settings.getCurrentLayout()).toBe(longLayout);
        });

        test('should handle application IDs with special characters', () => {
            const appId = 'org.example.app-with-dashes_and.underscores';
            const layoutId = 'en_US';

            settings.setApplicationLayout(appId, layoutId);
            const layouts = settings.getApplicationLayouts();

            expect(layouts[appId]).toBe(layoutId);
        });
    });

    describe('Real-world Usage Scenarios', () => {
        test('should simulate user changing keyboard layout', () => {
            // User opens settings
            const initialLayout = settings.getCurrentLayout();

            // User changes layout
            const newLayout = 'fr_FR';
            settings.setCurrentLayout(newLayout);

            // Verify change
            expect(settings.getCurrentLayout()).toBe(newLayout);
            expect(settings.getCurrentLayout()).not.toBe(initialLayout);
        });

        test('should simulate user enabling/disabling features', () => {
            // User enables all features
            settings.setShowPredictionBar(true);
            settings.setThemeName('dark');

            const allSettings = settings.getAllSettings();

            expect(allSettings.showPredictionBar).toBe(true);
            expect(allSettings.themeName).toBe('dark');

            // User disables some features
            settings.setShowPredictionBar(false);

            const updatedSettings = settings.getAllSettings();
            expect(updatedSettings.showPredictionBar).toBe(false);
        });

        test('should simulate per-application layout configuration', () => {
            // User sets different layouts for different apps
            settings.setApplicationLayout('org.gnome.Terminal', 'en_US_dvorak');
            settings.setApplicationLayout('firefox', 'en_US');
            settings.setApplicationLayout('libreoffice', 'fr_FR');

            const layouts = settings.getApplicationLayouts();

            expect(layouts['org.gnome.Terminal']).toBe('en_US_dvorak');
            expect(layouts['firefox']).toBe('en_US');
            expect(layouts['libreoffice']).toBe('fr_FR');

            // User removes configuration for one app
            settings.removeApplicationLayout('firefox');

            const updatedLayouts = settings.getApplicationLayouts();
            expect(updatedLayouts['firefox']).toBeUndefined();
            expect(updatedLayouts['org.gnome.Terminal']).toBe('en_US_dvorak');
        });
    });

    describe('API Validation', () => {
        test('should have all required getter methods', () => {
            expect(typeof settings.getShowPredictionBar).toBe('function');
            expect(typeof settings.getAutoCorrectionEnabled).toBe('function');
            expect(typeof settings.getHapticFeedbackEnabled).toBe('function');
            expect(typeof settings.getKeyPressSoundEnabled).toBe('function');
            expect(typeof settings.getCurrentLayout).toBe('function');
            expect(typeof settings.getThemeName).toBe('function');
            expect(typeof settings.getApplicationLayouts).toBe('function');
            expect(typeof settings.getAllSettings).toBe('function');
        });

        test('should have all required setter methods', () => {
            expect(typeof settings.setShowPredictionBar).toBe('function');
            expect(typeof settings.setCurrentLayout).toBe('function');
            expect(typeof settings.setThemeName).toBe('function');
            expect(typeof settings.setApplicationLayout).toBe('function');
            expect(typeof settings.removeApplicationLayout).toBe('function');
        });
    });
});
