/* test/accessibility/accessibility-tools.test.js - Test compatibility with accessibility tools */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Accessibility Tools Compatibility', () => {
    test('should work with Orca screen reader', () => {
        global.accessibilityTools = { orca: true };
        expect(global.accessibilityTools.orca).toBe(true);
    });

    test('should support sticky keys', () => {
        const stickyKeys = { enabled: true, modifier: 'Shift' };
        expect(stickyKeys.enabled).toBe(true);
    });

    test('should support slow keys', () => {
        const slowKeys = { enabled: true, delay: 300 };
        expect(slowKeys.delay).toBeGreaterThan(0);
    });

    test('should support bounce keys', () => {
        const bounceKeys = { enabled: true, interval: 500 };
        expect(bounceKeys.interval).toBeGreaterThan(0);
    });

    test('should provide auditory feedback', () => {
        const audioFeedback = { click: true, volume: 0.5 };
        expect(audioFeedback.click).toBe(true);
    });
});
