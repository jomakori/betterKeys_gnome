/* test/integration/settings.test.js - Integration test for settings persistence */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Settings Integration', () => {
    let settings;

    beforeAll(() => {
        settings = new MockSettingsManager();
    });

    test('should persist settings across operations', () => {
        settings.set('theme', 'dark');
        expect(settings.get('theme')).toBe('dark');
        settings.set('theme', 'light');
        expect(settings.get('theme')).toBe('light');
    });

    test('should handle multiple settings', () => {
        settings.set('keyboard-layout', 'qwerty');
        settings.set('gesture-enabled', true);
        settings.set('prediction-threshold', 0.7);
        expect(settings.get('keyboard-layout')).toBe('qwerty');
        expect(settings.get('gesture-enabled')).toBe(true);
        expect(settings.get('prediction-threshold')).toBe(0.7);
    });

    test('should emit change signals', () => {
        let changeCount = 0;
        settings.connect('changed', () => { changeCount++; });
        settings.set('theme', 'dark');
        expect(changeCount).toBe(1);
        settings.set('theme', 'light');
        expect(changeCount).toBe(2);
    });

    test('should reset to null', () => {
        settings.set('theme', 'custom');
        expect(settings.get('theme')).toBe('custom');
        settings.reset('theme');
        expect(settings.get('theme')).toBeNull();
    });

    test('should serialize and deserialize', () => {
        settings.set('theme', 'dark');
        settings.set('layout', 'qwerty');
        const data = settings.serialize();
        expect(typeof data).toBe('object');
        expect(data.theme).toBe('dark');
        expect(data.layout).toBe('qwerty');
        // Simulate deserialization
        const newSettings = new MockSettingsManager();
        newSettings.deserialize(data);
        expect(newSettings.get('theme')).toBe('dark');
        expect(newSettings.get('layout')).toBe('qwerty');
    });

    test('should integrate with components', () => {
        // Mock component that uses settings
        const Component = class {
            constructor(settings) {
                this.settings = settings;
                this.layout = settings.get('keyboard-layout') || 'qwerty';
            }
            updateLayout() {
                this.layout = this.settings.get('keyboard-layout');
            }
        };
        const component = new Component(settings);
        expect(component.layout).toBe('qwerty'); // default because key not set
        settings.set('keyboard-layout', 'dvorak');
        component.updateLayout();
        expect(component.layout).toBe('dvorak');
    });
});
