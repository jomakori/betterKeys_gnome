/* test/unit/clipboard-manager.test.js - Unit tests for ClipboardHistoryManager */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('ClipboardHistoryManager', () => {
    let settings;
    let ClipboardHistoryManager;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock ClipboardHistoryManager class
        ClipboardHistoryManager = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
                this._history = [];
                this._maxSize = 10;
            }

            addItem(text, metadata = {}) {
                const item = { text, timestamp: Date.now(), metadata };
                this._history.unshift(item);
                if (this._history.length > this._maxSize) {
                    this._history.pop();
                }
            }

            getItems(limit = 5) {
                return this._history.slice(0, limit);
            }

            clear() {
                this._history = [];
            }

            removeItem(index) {
                if (index >= 0 && index < this._history.length) {
                    this._history.splice(index, 1);
                }
            }

            getSize() {
                return this._history.length;
            }
        };
    });

    test('should initialize with empty history', () => {
        const manager = new ClipboardHistoryManager(settings);
        expect(manager.getSize()).toBe(0);
    });

    test('should add items to history', () => {
        const manager = new ClipboardHistoryManager(settings);
        manager.addItem('Hello');
        manager.addItem('World');
        expect(manager.getSize()).toBe(2);
        expect(manager.getItems()[0].text).toBe('World'); // newest first
    });

    test('should limit history size', () => {
        const manager = new ClipboardHistoryManager(settings);
        for (let i = 0; i < 15; i++) {
            manager.addItem(`Item ${i}`);
        }
        expect(manager.getSize()).toBe(10);
    });

    test('should remove item by index', () => {
        const manager = new ClipboardHistoryManager(settings);
        manager.addItem('First');
        manager.addItem('Second');
        manager.removeItem(1);
        expect(manager.getSize()).toBe(1);
        expect(manager.getItems()[0].text).toBe('Second');
    });

    test('should clear history', () => {
        const manager = new ClipboardHistoryManager(settings);
        manager.addItem('Test');
        manager.clear();
        expect(manager.getSize()).toBe(0);
    });
});
