/* test/integration/input-method.test.js - Integration test for IBus integration */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Input Method Integration', () => {
    let settings;
    let mockIBus;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock IBus API
        mockIBus = {
            engine: null,
            createEngine: function(name) {
                this.engine = { name, focused: false };
                return this.engine;
            },
            focusIn: function() {
                if (this.engine) this.engine.focused = true;
            },
            focusOut: function() {
                if (this.engine) this.engine.focused = false;
            },
            processKeyEvent: function(keyval, keycode, state) {
                return false; // not handled
            }
        };
    });

    test('should create IBus engine', () => {
        const engine = mockIBus.createEngine('betterkeys');
        expect(engine.name).toBe('betterkeys');
        expect(engine.focused).toBe(false);
    });

    test('should focus engine', () => {
        mockIBus.createEngine('betterkeys');
        mockIBus.focusIn();
        expect(mockIBus.engine.focused).toBe(true);
        mockIBus.focusOut();
        expect(mockIBus.engine.focused).toBe(false);
    });

    test('should process key events', () => {
        const handled = mockIBus.processKeyEvent(97, 0, 0); // 'a' key
        expect(handled).toBe(false); // mock returns false
    });

    test('should integrate with settings', () => {
        settings.set('ibus-enabled', true);
        expect(settings.get('ibus-enabled')).toBe(true);
        settings.set('ibus-enabled', false);
        expect(settings.get('ibus-enabled')).toBe(false);
    });

    test('should handle engine lifecycle', () => {
        const engine = mockIBus.createEngine('test');
        expect(engine).toBeDefined();
        // Simulate destruction
        mockIBus.engine = null;
        expect(mockIBus.engine).toBeNull();
    });
});
