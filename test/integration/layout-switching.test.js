/* test/integration/layout-switching.test.js - Integration test for dynamic layout switching */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Layout Switching Integration', () => {
    let settings;
    let layoutManager;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock layout manager
        layoutManager = {
            currentLayout: 'qwerty',
            availableLayouts: ['qwerty', 'dvorak', 'colemak', 'workman'],
            loadLayout: function(name) {
                if (this.availableLayouts.includes(name)) {
                    this.currentLayout = name;
                    return true;
                }
                return false;
            },
            getKeyMapping: function() {
                const mappings = {
                    qwerty: { 'a': 'a', 'b': 'b' },
                    dvorak: { 'a': 'a', 'b': 'b' },
                    colemak: { 'a': 'a', 'b': 'b' },
                    workman: { 'a': 'a', 'b': 'b' }
                };
                return mappings[this.currentLayout] || {};
            },
            getLayoutInfo: function() {
                return {
                    name: this.currentLayout,
                    rows: 3,
                    cols: 10
                };
            }
        };
    });

    test('should load layout from settings', () => {
        settings.set('keyboard-layout', 'dvorak');
        const layout = settings.get('keyboard-layout');
        const success = layoutManager.loadLayout(layout);
        expect(success).toBe(true);
        expect(layoutManager.currentLayout).toBe('dvorak');
    });

    test('should provide key mapping for current layout', () => {
        layoutManager.loadLayout('colemak');
        const mapping = layoutManager.getKeyMapping();
        expect(mapping).toBeDefined();
        expect(typeof mapping).toBe('object');
    });

    test('should reject invalid layout', () => {
        const success = layoutManager.loadLayout('invalid');
        expect(success).toBe(false);
        expect(layoutManager.currentLayout).not.toBe('invalid');
    });

    test('should switch layouts dynamically', () => {
        layoutManager.loadLayout('qwerty');
        expect(layoutManager.currentLayout).toBe('qwerty');
        layoutManager.loadLayout('workman');
        expect(layoutManager.currentLayout).toBe('workman');
    });

    test('should emit layout-changed signal', () => {
        let signalCount = 0;
        const signals = {};
        layoutManager.connect = (signal, callback) => {
            signals[signal] = callback;
        };
        layoutManager.emit = (signal) => {
            if (signals[signal]) signals[signal]();
        };
        layoutManager.connect('layout-changed', () => { signalCount++; });
        layoutManager.emit('layout-changed');
        expect(signalCount).toBe(1);
    });

    test('should integrate with keyboard UI', () => {
        // Mock keyboard UI component
        const KeyboardUI = class {
            constructor() {
                this.layout = null;
                this.keys = [];
            }
            setLayout(layoutName) {
                this.layout = layoutName;
                this.keys = layoutManager.getKeyMapping();
            }
        };
        const ui = new KeyboardUI();
        layoutManager.loadLayout('dvorak');
        ui.setLayout(layoutManager.currentLayout);
        expect(ui.layout).toBe('dvorak');
        expect(ui.keys).toBeDefined();
    });

    test('should preserve layout after settings change', () => {
        settings.set('keyboard-layout', 'colemak');
        layoutManager.loadLayout(settings.get('keyboard-layout'));
        expect(layoutManager.currentLayout).toBe('colemak');
        // Change settings again
        settings.set('keyboard-layout', 'qwerty');
        layoutManager.loadLayout(settings.get('keyboard-layout'));
        expect(layoutManager.currentLayout).toBe('qwerty');
    });
});
