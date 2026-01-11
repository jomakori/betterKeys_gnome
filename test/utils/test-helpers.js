/* test/utils/test-helpers.js - Testing utilities for betterKeys */

/**
 * Assert that a condition is true.
 * @param {boolean} condition - Condition to assert.
 * @param {string} message - Error message.
 */
function assert(condition, message = 'Assertion failed') {
    if (!condition) {
        throw new Error(message);
    }
}

/**
 * Assert equality of two values.
 * @param {*} actual - Actual value.
 * @param {*} expected - Expected value.
 * @param {string} message - Error message.
 */
function assertEquals(actual, expected, message = `Expected ${expected}, got ${actual}`) {
    if (actual !== expected) {
        throw new Error(message);
    }
}

/**
 * Assert deep equality of objects (simple).
 * @param {*} actual - Actual object.
 * @param {*} expected - Expected object.
 * @param {string} message - Error message.
 */
function assertDeepEquals(actual, expected, message = 'Objects not deeply equal') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
    }
}

/**
 * Assert that a function throws an error.
 * @param {Function} fn - Function to call.
 * @param {string} expectedError - Expected error message (optional).
 */
function assertThrows(fn, expectedError) {
    try {
        fn();
        throw new Error('Expected function to throw');
    } catch (error) {
        if (expectedError && !error.message.includes(expectedError)) {
            throw new Error(`Expected error containing "${expectedError}", got "${error.message}"`);
        }
    }
}

/**
 * Mock settings manager for testing.
 */
class MockSettingsManager {
    constructor() {
        this._values = new Map();
        this._listeners = [];
    }

    get_int(key) {
        return this._values.get(key) || 0;
    }

    set_int(key, value) {
        this._values.set(key, value);
        this._notify(key);
    }

    get_boolean(key) {
        return this._values.get(key) || false;
    }

    set_boolean(key, value) {
        this._values.set(key, value);
        this._notify(key);
    }

    get_string(key) {
        return this._values.get(key) || '';
    }

    set_string(key, value) {
        this._values.set(key, value);
        this._notify(key);
    }

    connect(event, callback) {
        this._listeners.push(callback);
    }

    _notify(key) {
        this._listeners.forEach(cb => cb(this, key));
    }

    // Generic get/set for convenience
    get(key) {
        return this._values.get(key) ?? null;
    }

    set(key, value) {
        this._values.set(key, value);
        this._notify(key);
    }

    reset(key) {
        this._values.delete(key);
        this._notify(key);
    }

    serialize() {
        return Object.fromEntries(this._values);
    }

    deserialize(data) {
        for (const [key, value] of Object.entries(data)) {
            this._values.set(key, value);
        }
    }
}

/**
 * Create a mock event object.
 */
function createMockEvent(type, data = {}) {
    return {
        type,
        ...data,
        preventDefault: () => {},
        stopPropagation: () => {},
    };
}

/**
 * Sleep for a given number of milliseconds (async).
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    assert,
    assertEquals,
    assertDeepEquals,
    assertThrows,
    MockSettingsManager,
    createMockEvent,
    sleep,
};
