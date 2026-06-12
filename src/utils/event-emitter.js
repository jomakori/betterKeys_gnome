/* src/utils/event-emitter.js - Custom event system for component communication */

import GObject from 'gi://GObject';

/**
 * EventEmitter provides a lightweight, memory‑safe event system
 * for component communication within betterKeys.
 */
export const EventEmitter = GObject.registerClass(
class EventEmitter extends GObject.Object {
    _init() {
        super._init();

        // Map event name → array of listener objects
        this._listeners = new Map();

        // Maximum listeners per event (to detect potential leaks)
        this._maxListeners = 20;

        // Statistics
        this._stats = {
            totalEventsEmitted: 0,
            totalListenersAdded: 0,
            totalListenersRemoved: 0
        };

        log('[betterKeys] EventEmitter initialized');
    }

    /**
     * Register a listener for an event.
     * @param {string} eventName - Name of the event.
     * @param {Function} callback - Callback function.
     * @param {Object} options - Optional settings.
     * @returns {Function} Unsubscribe function.
     */
    on(eventName, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, []);
        }

        const listeners = this._listeners.get(eventName);

        // Check listener limit
        if (listeners.length >= this._maxListeners) {
            logError(`[betterKeys] Event "${eventName}" exceeded max listeners (${this._maxListeners}). Possible memory leak.`);
        }

        const listener = {
            callback,
            once: !!options.once,
            context: options.context || null,
            id: Symbol('listener')
        };

        listeners.push(listener);
        this._stats.totalListenersAdded++;

        // Return unsubscribe function
        return () => this.off(eventName, listener.id);
    }

    /**
     * Register a one‑time listener.
     * @param {string} eventName - Name of the event.
     * @param {Function} callback - Callback function.
     * @returns {Function} Unsubscribe function.
     */
    once(eventName, callback) {
        return this.on(eventName, callback, { once: true });
    }

    /**
     * Remove a listener.
     * @param {string} eventName - Name of the event.
     * @param {Function|Symbol} identifier - Callback function or listener ID.
     * @returns {boolean} True if a listener was removed.
     */
    off(eventName, identifier) {
        if (!this._listeners.has(eventName)) {
            return false;
        }

        const listeners = this._listeners.get(eventName);
        const initialLength = listeners.length;

        if (typeof identifier === 'function') {
            // Remove by callback reference
            this._listeners.set(
                eventName,
                listeners.filter(l => l.callback !== identifier)
            );
        } else if (typeof identifier === 'symbol') {
            // Remove by listener ID
            this._listeners.set(
                eventName,
                listeners.filter(l => l.id !== identifier)
            );
        } else {
            // Remove all listeners for this event
            this._listeners.delete(eventName);
        }

        const removed = initialLength - this._listeners.get(eventName)?.length || initialLength;
        this._stats.totalListenersRemoved += removed;

        return removed > 0;
    }

    /**
     * Emit an event, calling all registered listeners.
     * @param {string} eventName - Name of the event.
     * @param {...any} args - Arguments to pass to listeners.
     * @returns {boolean} True if any listener was called.
     */
    emit(eventName, ...args) {
        if (!this._listeners.has(eventName)) {
            return false;
        }

        const listeners = this._listeners.get(eventName);
        if (listeners.length === 0) {
            return false;
        }

        // Create a copy to avoid issues if listeners are added/removed during iteration
        const listenersToCall = [...listeners];

        // Track which listeners should be removed after calling (once listeners)
        const toRemove = [];

        for (const listener of listenersToCall) {
            try {
                // Call with appropriate context
                const context = listener.context || this;
                listener.callback.apply(context, args);

                if (listener.once) {
                    toRemove.push(listener.id);
                }
            } catch (error) {
                logError(`[betterKeys] Error in event listener for "${eventName}": ${error}`);
                // Continue with other listeners
            }
        }

        // Remove once listeners
        if (toRemove.length > 0) {
            const currentListeners = this._listeners.get(eventName);
            this._listeners.set(
                eventName,
                currentListeners.filter(l => !toRemove.includes(l.id))
            );
            this._stats.totalListenersRemoved += toRemove.length;
        }

        this._stats.totalEventsEmitted++;
        return true;
    }

    /**
     * Get the number of listeners for an event.
     * @param {string} eventName - Name of the event.
     * @returns {number} Listener count.
     */
    listenerCount(eventName) {
        if (!this._listeners.has(eventName)) {
            return 0;
        }
        return this._listeners.get(eventName).length;
    }

    /**
     * Get all event names that have listeners.
     * @returns {string[]} Array of event names.
     */
    eventNames() {
        return Array.from(this._listeners.keys());
    }

    /**
     * Remove all listeners for a specific event, or all events.
     * @param {string} eventName - Optional event name.
     */
    removeAllListeners(eventName) {
        if (eventName !== undefined) {
            const count = this.listenerCount(eventName);
            this._listeners.delete(eventName);
            this._stats.totalListenersRemoved += count;
            log(`[betterKeys] Removed all listeners for "${eventName}"`);
        } else {
            const total = this._totalListenerCount();
            this._listeners.clear();
            this._stats.totalListenersRemoved += total;
            log('[betterKeys] Removed all listeners for all events');
        }
    }

    /**
     * Get total number of listeners across all events.
     * @returns {number} Total listener count.
     */
    _totalListenerCount() {
        let total = 0;
        for (const listeners of this._listeners.values()) {
            total += listeners.length;
        }
        return total;
    }

    /**
     * Set the maximum number of listeners per event.
     * @param {number} n - New maximum.
     */
    setMaxListeners(n) {
        if (typeof n !== 'number' || n < 0) {
            throw new Error('Max listeners must be a non‑negative number');
        }
        this._maxListeners = n;
    }

    /**
     * Get current maximum listeners per event.
     * @returns {number} Maximum listeners.
     */
    getMaxListeners() {
        return this._maxListeners;
    }

    /**
     * Get emitter statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        return {
            ...this._stats,
            totalEvents: this.eventNames().length,
            totalListeners: this._totalListenerCount(),
            maxListeners: this._maxListeners
        };
    }

    /**
     * Reset statistics (does not remove listeners).
     */
    resetStats() {
        this._stats = {
            totalEventsEmitted: 0,
            totalListenersAdded: 0,
            totalListenersRemoved: 0
        };
    }

    /**
     * Create a promise that resolves when a specific event is emitted.
     * @param {string} eventName - Name of the event.
     * @param {Function} condition - Optional condition function.
     * @returns {Promise} Promise that resolves with event arguments.
     */
    waitFor(eventName, condition = null) {
        return new Promise((resolve) => {
            const listener = (...args) => {
                if (condition && !condition(...args)) {
                    return; // condition not satisfied, keep waiting
                }
                this.off(eventName, listener);
                resolve(args.length === 1 ? args[0] : args);
            };
            this.on(eventName, listener);
        });
    }

    /**
     * Pipe events from another emitter to this one.
     * @param {EventEmitter} source - Source emitter.
     * @param {string|string[]} events - Event name(s) to pipe.
     * @param {string} transform - Optional transformation prefix.
     * @returns {Function} Function to stop piping.
     */
    pipe(source, events, transform = null) {
        if (!Array.isArray(events)) {
            events = [events];
        }

        const listeners = [];

        for (const event of events) {
            const targetEvent = transform ? `${transform}:${event}` : event;
            const listener = (...args) => {
                this.emit(targetEvent, ...args);
            };
            source.on(event, listener);
            listeners.push({ event, listener });
        }

        // Return a function to unpipe
        return () => {
            for (const { event, listener } of listeners) {
                source.off(event, listener);
            }
        };
    }

    /**
     * Destroy the emitter, removing all listeners.
     */
    destroy() {
        this.removeAllListeners();
        log('[betterKeys] EventEmitter destroyed');
    }
});
