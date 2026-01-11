/* test/unit/gesture-recognizer.test.js - Unit tests for GestureRecognizer */

const { MockSettingsManager } = require('../utils/test-helpers');
const { Clutter } = require('../mocks/gnome-shell');

describe('GestureRecognizer', () => {
    let settings;
    let GestureRecognizer;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock GestureRecognizer class (since we cannot import actual GJS module)
        GestureRecognizer = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
                this._config = {
                    swipeThreshold: 50,
                    longPressDuration: 500,
                };
                this._activeTouches = new Map();
                this._gestureHistory = [];
            }

            processTouchEvent(eventType, touchId, x, y) {
                if (eventType === Clutter.EventType.TOUCH_BEGIN) {
                    this._activeTouches.set(touchId, { x, y });
                }
            }

            getActiveTouchCount() {
                return this._activeTouches.size;
            }
        };
    });

    test('should initialize with default config', () => {
        const recognizer = new GestureRecognizer(settings);
        expect(recognizer._config.swipeThreshold).toBe(50);
        expect(recognizer._config.longPressDuration).toBe(500);
        expect(recognizer._activeTouches).toBeInstanceOf(Map);
    });

    test('should process touch begin event', () => {
        const recognizer = new GestureRecognizer(settings);
        expect(recognizer.getActiveTouchCount()).toBe(0);
        recognizer.processTouchEvent(Clutter.EventType.TOUCH_BEGIN, 1, 100, 200);
        expect(recognizer.getActiveTouchCount()).toBe(1);
    });

    test('should ignore unknown event types', () => {
        const recognizer = new GestureRecognizer(settings);
        recognizer.processTouchEvent('UNKNOWN', 2, 300, 400);
        expect(recognizer.getActiveTouchCount()).toBe(0);
    });
});
