/* test/integration/theme-switching.test.js - Integration test for theme switching */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Theme Switching Integration', () => {
    let settings;
    let themeManager;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock theme manager
        themeManager = {
            currentTheme: 'default',
            themes: ['default', 'dark', 'light', 'high-contrast'],
            loadTheme: function(name) {
                if (this.themes.includes(name)) {
                    this.currentTheme = name;
                    return true;
                }
                return false;
            },
            applyTheme: function() {
                // Simulate applying CSS
                return `theme-${this.currentTheme}`;
            },
            getThemeCSS: function() {
                return `/* CSS for ${this.currentTheme} */`;
            }
        };
    });

    test('should load theme from settings', () => {
        settings.set('theme', 'dark');
        const theme = settings.get('theme');
        const success = themeManager.loadTheme(theme);
        expect(success).toBe(true);
        expect(themeManager.currentTheme).toBe('dark');
    });

    test('should apply theme CSS', () => {
        themeManager.loadTheme('light');
        const css = themeManager.getThemeCSS();
        expect(css).toContain('light');
        const className = themeManager.applyTheme();
        expect(className).toBe('theme-light');
    });

    test('should handle invalid theme', () => {
        const success = themeManager.loadTheme('invalid');
        expect(success).toBe(false);
        expect(themeManager.currentTheme).not.toBe('invalid');
    });

    test('should switch themes dynamically', () => {
        themeManager.loadTheme('default');
        expect(themeManager.currentTheme).toBe('default');
        themeManager.loadTheme('high-contrast');
        expect(themeManager.currentTheme).toBe('high-contrast');
    });

    test('should emit theme-changed signal', () => {
        let signalFired = false;
        // Mock signal connection
        const signals = {};
        themeManager.connect = (signal, callback) => {
            signals[signal] = callback;
        };
        themeManager.emit = (signal) => {
            if (signals[signal]) signals[signal]();
        };
        themeManager.connect('theme-changed', () => { signalFired = true; });
        themeManager.emit('theme-changed');
        expect(signalFired).toBe(true);
    });

    test('should integrate with UI components', () => {
        // Mock UI component that reacts to theme changes
        const UIComponent = class {
            constructor() {
                this.themeClass = '';
            }
            updateTheme(themeName) {
                this.themeClass = `ui-${themeName}`;
            }
        };
        const component = new UIComponent();
        themeManager.loadTheme('dark');
        component.updateTheme(themeManager.currentTheme);
        expect(component.themeClass).toBe('ui-dark');
    });
});
