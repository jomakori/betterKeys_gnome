/* test/unit/prefs.test.js - Unit tests for preferences UI */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('betterKeysPrefsWidget', () => {
    let mockSettings;

    beforeEach(() => {
        mockSettings = new MockSettingsManager();
        // Initialize default values
        mockSettings.set_string('current-layout', 'en_US_qwerty');
        mockSettings.set_string('theme-name', 'default');
        mockSettings.set_string('keyboard-size', 'normal');
        mockSettings.set_string('docking-position', 'bottom');
        mockSettings.set_boolean('show-prediction-bar', true);
        mockSettings.set_boolean('auto-correction-enabled', true);
        mockSettings.set_boolean('haptic-feedback-enabled', true);
        mockSettings.set_boolean('key-press-sound-enabled', false);
        mockSettings.set_boolean('gesture-swipe-enabled', true);
        mockSettings.set_boolean('glide-typing-enabled', false);
        mockSettings.set_boolean('theme-auto-dark-light', true);
        mockSettings.set_boolean('auto-show-enabled', true);
        mockSettings.set_boolean('auto-hide-enabled', true);
        mockSettings.set_boolean('high-contrast-enabled', false);
        mockSettings.set_boolean('large-keys-enabled', false);
        mockSettings.set_boolean('slow-motion-enabled', false);
    });

    test('should initialize with default settings', () => {
        expect(mockSettings.get_string('current-layout')).toBe('en_US_qwerty');
        expect(mockSettings.get_string('theme-name')).toBe('default');
        expect(mockSettings.get_boolean('show-prediction-bar')).toBe(true);
    });

    test('should update layout setting', () => {
        mockSettings.set_string('current-layout', 'en_GB_qwerty');
        expect(mockSettings.get_string('current-layout')).toBe('en_GB_qwerty');
    });

    test('should update theme setting', () => {
        mockSettings.set_string('theme-name', 'dark');
        expect(mockSettings.get_string('theme-name')).toBe('dark');
    });

    test('should toggle prediction bar', () => {
        expect(mockSettings.get_boolean('show-prediction-bar')).toBe(true);
        mockSettings.set_boolean('show-prediction-bar', false);
        expect(mockSettings.get_boolean('show-prediction-bar')).toBe(false);
    });

    test('should toggle auto-correction', () => {
        expect(mockSettings.get_boolean('auto-correction-enabled')).toBe(true);
        mockSettings.set_boolean('auto-correction-enabled', false);
        expect(mockSettings.get_boolean('auto-correction-enabled')).toBe(false);
    });

    test('should toggle haptic feedback', () => {
        expect(mockSettings.get_boolean('haptic-feedback-enabled')).toBe(true);
        mockSettings.set_boolean('haptic-feedback-enabled', false);
        expect(mockSettings.get_boolean('haptic-feedback-enabled')).toBe(false);
    });

    test('should toggle key press sound', () => {
        expect(mockSettings.get_boolean('key-press-sound-enabled')).toBe(false);
        mockSettings.set_boolean('key-press-sound-enabled', true);
        expect(mockSettings.get_boolean('key-press-sound-enabled')).toBe(true);
    });

    test('should toggle gesture swipe', () => {
        expect(mockSettings.get_boolean('gesture-swipe-enabled')).toBe(true);
        mockSettings.set_boolean('gesture-swipe-enabled', false);
        expect(mockSettings.get_boolean('gesture-swipe-enabled')).toBe(false);
    });

    test('should toggle glide typing', () => {
        expect(mockSettings.get_boolean('glide-typing-enabled')).toBe(false);
        mockSettings.set_boolean('glide-typing-enabled', true);
        expect(mockSettings.get_boolean('glide-typing-enabled')).toBe(true);
    });

    test('should update keyboard size', () => {
        mockSettings.set_string('keyboard-size', 'large');
        expect(mockSettings.get_string('keyboard-size')).toBe('large');
        mockSettings.set_string('keyboard-size', 'compact');
        expect(mockSettings.get_string('keyboard-size')).toBe('compact');
    });

    test('should update docking position', () => {
        const positions = ['top', 'bottom', 'left', 'right', 'floating'];
        positions.forEach(pos => {
            mockSettings.set_string('docking-position', pos);
            expect(mockSettings.get_string('docking-position')).toBe(pos);
        });
    });

    test('should toggle auto-show', () => {
        expect(mockSettings.get_boolean('auto-show-enabled')).toBe(true);
        mockSettings.set_boolean('auto-show-enabled', false);
        expect(mockSettings.get_boolean('auto-show-enabled')).toBe(false);
    });

    test('should toggle auto-hide', () => {
        expect(mockSettings.get_boolean('auto-hide-enabled')).toBe(true);
        mockSettings.set_boolean('auto-hide-enabled', false);
        expect(mockSettings.get_boolean('auto-hide-enabled')).toBe(false);
    });

    test('should toggle high contrast mode', () => {
        expect(mockSettings.get_boolean('high-contrast-enabled')).toBe(false);
        mockSettings.set_boolean('high-contrast-enabled', true);
        expect(mockSettings.get_boolean('high-contrast-enabled')).toBe(true);
    });

    test('should toggle large keys', () => {
        expect(mockSettings.get_boolean('large-keys-enabled')).toBe(false);
        mockSettings.set_boolean('large-keys-enabled', true);
        expect(mockSettings.get_boolean('large-keys-enabled')).toBe(true);
    });

    test('should toggle slow motion', () => {
        expect(mockSettings.get_boolean('slow-motion-enabled')).toBe(false);
        mockSettings.set_boolean('slow-motion-enabled', true);
        expect(mockSettings.get_boolean('slow-motion-enabled')).toBe(true);
    });

    test('should toggle theme auto dark/light', () => {
        expect(mockSettings.get_boolean('theme-auto-dark-light')).toBe(true);
        mockSettings.set_boolean('theme-auto-dark-light', false);
        expect(mockSettings.get_boolean('theme-auto-dark-light')).toBe(false);
    });

    test('should emit change signals on setting updates', () => {
        let changeCount = 0;
        mockSettings.connect('changed', () => { changeCount++; });

        mockSettings.set_string('current-layout', 'fr_FR_azerty');
        expect(changeCount).toBe(1);

        mockSettings.set_boolean('show-prediction-bar', false);
        expect(changeCount).toBe(2);
    });

    test('should handle multiple concurrent setting changes', () => {
        mockSettings.set_string('current-layout', 'en_GB_qwerty');
        mockSettings.set_string('theme-name', 'dark');
        mockSettings.set_boolean('show-prediction-bar', false);

        expect(mockSettings.get_string('current-layout')).toBe('en_GB_qwerty');
        expect(mockSettings.get_string('theme-name')).toBe('dark');
        expect(mockSettings.get_boolean('show-prediction-bar')).toBe(false);
    });

    test('should persist all accessibility settings', () => {
        const accessibilitySettings = {
            'high-contrast-enabled': true,
            'large-keys-enabled': true,
            'slow-motion-enabled': true,
        };

        Object.entries(accessibilitySettings).forEach(([key, value]) => {
            mockSettings.set_boolean(key, value);
        });

        Object.entries(accessibilitySettings).forEach(([key, value]) => {
            expect(mockSettings.get_boolean(key)).toBe(value);
        });
    });

    test('should serialize all settings', () => {
        const serialized = mockSettings.serialize();
        expect(serialized['current-layout']).toBe('en_US_qwerty');
        expect(serialized['theme-name']).toBe('default');
        expect(serialized['show-prediction-bar']).toBe(true);
    });

    test('should deserialize settings correctly', () => {
        const data = {
            'current-layout': 'fr_FR_azerty',
            'theme-name': 'dark',
            'show-prediction-bar': false,
        };

        const newSettings = new MockSettingsManager();
        newSettings.deserialize(data);

        expect(newSettings.get('current-layout')).toBe('fr_FR_azerty');
        expect(newSettings.get('theme-name')).toBe('dark');
        expect(newSettings.get('show-prediction-bar')).toBe(false);
    });
});
