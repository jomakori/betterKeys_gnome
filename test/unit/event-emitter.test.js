/* test/unit/event-emitter.test.js - Unit tests for EventEmitter */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('EventEmitter', () => {
    let EventEmitter;

    beforeAll(() => {
        // Mock EventEmitter class
        EventEmitter = class {
            constructor() {
                this._listeners = new Map();
            }

            on(event, callback) {
                if (!this._listeners.has(event)) {
                    this._listeners.set(event, []);
                }
                this._listeners.get(event).push(callback);
                return this;
            }

            off(event, callback) {
                if (!this._listeners.has(event)) return;
                const list = this._listeners.get(event);
                const index = list.indexOf(callback);
                if (index !== -1) list.splice(index, 1);
                return this;
            }

            emit(event, ...args) {
                if (!this._listeners.has(event)) return;
                const listeners = this._listeners.get(event).slice();
                for (const cb of listeners) {
                    try {
                        cb(...args);
                    } catch (e) {
                        console.error(`Error in event listener for ${event}:`, e);
                    }
                }
                return this;
            }

            once(event, callback) {
                const wrapper = (...args) => {
                    this.off(event, wrapper);
                    callback(...args);
                };
                this.on(event, wrapper);
                return this;
            }

            listenerCount(event) {
                if (!this._listeners.has(event)) return 0;
                return this._listeners.get(event).length;
            }

            removeAllListeners(event) {
                if (event) {
                    this._listeners.delete(event);
                } else {
                    this._listeners.clear();
                }
                return this;
            }
        };
    });

    test('should add and trigger listeners', () => {
        const emitter = new EventEmitter();
        let called = false;
        emitter.on('test', () => { called = true; });
        emitter.emit('test');
        expect(called).toBe(true);
    });

    test('should pass arguments to listeners', () => {
        const emitter = new EventEmitter();
        let received = null;
        emitter.on('data', (arg) => { received = arg; });
        emitter.emit('data', 42);
        expect(received).toBe(42);
    });

    test('should support multiple listeners', () => {
        const emitter = new EventEmitter();
        let count = 0;
        emitter.on('inc', () => { count++; });
        emitter.on('inc', () => { count += 2; });
        emitter.emit('inc');
        expect(count).toBe(3);
    });

    test('should remove specific listener with off', () => {
        const emitter = new EventEmitter();
        let calls = 0;
        const cb1 = () => { calls++; };
        const cb2 = () => { calls += 10; };
        emitter.on('event', cb1);
        emitter.on('event', cb2);
        emitter.off('event', cb1);
        emitter.emit('event');
        expect(calls).toBe(10);
    });

    test('should support once listener', () => {
        const emitter = new EventEmitter();
        let calls = 0;
        emitter.once('once', () => { calls++; });
        emitter.emit('once');
        emitter.emit('once');
        expect(calls).toBe(1);
    });

    test('should count listeners', () => {
        const emitter = new EventEmitter();
        expect(emitter.listenerCount('foo')).toBe(0);
        emitter.on('foo', () => {});
        expect(emitter.listenerCount('foo')).toBe(1);
        emitter.on('foo', () => {});
        expect(emitter.listenerCount('foo')).toBe(2);
        emitter.off('foo');
        expect(emitter.listenerCount('foo')).toBe(2); // off without callback does nothing
    });

    test('should remove all listeners for event', () => {
        const emitter = new EventEmitter();
        emitter.on('a', () => {});
        emitter.on('a', () => {});
        emitter.on('b', () => {});
        expect(emitter.listenerCount('a')).toBe(2);
        emitter.removeAllListeners('a');
        expect(emitter.listenerCount('a')).toBe(0);
        expect(emitter.listenerCount('b')).toBe(1);
    });

    test('should remove all listeners globally', () => {
        const emitter = new EventEmitter();
        emitter.on('x', () => {});
        emitter.on('y', () => {});
        emitter.removeAllListeners();
        expect(emitter.listenerCount('x')).toBe(0);
        expect(emitter.listenerCount('y')).toBe(0);
    });

    test('should handle errors in listeners gracefully', () => {
        const emitter = new EventEmitter();
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        emitter.on('error', () => { throw new Error('test error'); });
        expect(() => emitter.emit('error')).not.toThrow();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
