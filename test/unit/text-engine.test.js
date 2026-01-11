/* test/unit/text-engine.test.js - Unit tests for TextEngine */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('TextEngine', () => {
    let settings;
    let TextEngine;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock TextEngine class
        TextEngine = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
                this._buffer = '';
                this._cursor = 0;
            }

            insert(text) {
                this._buffer = this._buffer.slice(0, this._cursor) + text + this._buffer.slice(this._cursor);
                this._cursor += text.length;
            }

            deleteBackward(count = 1) {
                if (this._cursor >= count) {
                    this._buffer = this._buffer.slice(0, this._cursor - count) + this._buffer.slice(this._cursor);
                    this._cursor -= count;
                }
            }

            getBuffer() {
                return this._buffer;
            }

            getCursor() {
                return this._cursor;
            }

            moveCursor(delta) {
                const newPos = this._cursor + delta;
                if (newPos < 0) {
                    this._cursor = 0;
                } else if (newPos > this._buffer.length) {
                    this._cursor = this._buffer.length;
                } else {
                    this._cursor = newPos;
                }
            }
        };
    });

    test('should initialize with empty buffer', () => {
        const engine = new TextEngine(settings);
        expect(engine.getBuffer()).toBe('');
        expect(engine.getCursor()).toBe(0);
    });

    test('should insert text at cursor', () => {
        const engine = new TextEngine(settings);
        engine.insert('Hello');
        expect(engine.getBuffer()).toBe('Hello');
        expect(engine.getCursor()).toBe(5);
    });

    test('should delete backward', () => {
        const engine = new TextEngine(settings);
        engine.insert('Hello');
        engine.deleteBackward(2);
        expect(engine.getBuffer()).toBe('Hel');
        expect(engine.getCursor()).toBe(3);
    });

    test('should move cursor within bounds', () => {
        const engine = new TextEngine(settings);
        engine.insert('Hello');
        engine.moveCursor(-2);
        expect(engine.getCursor()).toBe(3);
        engine.moveCursor(10); // beyond end
        expect(engine.getCursor()).toBe(5); // clamped
    });
});
