/* test/unit/layout-manager.test.js - Unit tests for LayoutManager */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('LayoutManager', () => {
    let settings;
    let LayoutManager;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock LayoutManager class
        LayoutManager = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
                this._layouts = new Map([
                    ['qwerty', { name: 'QWERTY', rows: 3 }],
                    ['dvorak', { name: 'Dvorak', rows: 3 }],
                    ['colemak', { name: 'Colemak', rows: 3 }]
                ]);
                this._currentLayout = 'qwerty';
            }

            getLayout(id) {
                return this._layouts.get(id);
            }

            setCurrentLayout(id) {
                if (this._layouts.has(id)) {
                    this._currentLayout = id;
                    return true;
                }
                return false;
            }

            getCurrentLayout() {
                return this._currentLayout;
            }

            listLayouts() {
                return Array.from(this._layouts.keys());
            }
        };
    });

    test('should initialize with default layout', () => {
        const manager = new LayoutManager(settings);
        expect(manager.getCurrentLayout()).toBe('qwerty');
        expect(manager.listLayouts()).toHaveLength(3);
    });

    test('should retrieve layout by id', () => {
        const manager = new LayoutManager(settings);
        const layout = manager.getLayout('dvorak');
        expect(layout).toBeDefined();
        expect(layout.name).toBe('Dvorak');
    });

    test('should switch current layout', () => {
        const manager = new LayoutManager(settings);
        expect(manager.setCurrentLayout('colemak')).toBe(true);
        expect(manager.getCurrentLayout()).toBe('colemak');
    });

    test('should reject invalid layout switch', () => {
        const manager = new LayoutManager(settings);
        expect(manager.setCurrentLayout('invalid')).toBe(false);
        expect(manager.getCurrentLayout()).toBe('qwerty'); // unchanged
    });
});
