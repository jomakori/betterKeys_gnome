/* src/performance/optimizer.js - Performance optimization, caching, and monitoring */

const { GObject, GLib, Gio, Clutter } = imports.gi;

/**
 * PerformanceOptimizer - Centralized performance optimization and monitoring
 *
 * Features:
 * - LRU caching for layouts, predictions, emoji, special characters, themes
 * - Performance metrics collection (latency, memory, CPU)
 * - Object pooling for frequently created objects
 * - Lazy loading of heavy resources
 * - Batch DOM updates and rendering optimizations
 * - Memory footprint monitoring and cleanup
 */
const PerformanceOptimizer = GObject.registerClass(
class PerformanceOptimizer extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._isEnabled = true;

        // Configuration
        this._config = {
            // Caching
            layoutCacheSize: 50,
            predictionCacheSize: 500,
            emojiCacheSize: 200,
            specialCharsCacheSize: 100,
            themeCacheSize: 10,
            strokeRecognitionCacheSize: 100,
            vocabularyCacheSize: 1000,

            // Performance monitoring
            enableMetrics: true,
            metricsInterval: 5000, // ms
            logPerformanceWarnings: true,
            maxMemoryMB: 100,
            targetLatencyMs: 50,
            targetPredictionMs: 100,
            targetGestureMs: 200,

            // Optimization flags
            enableObjectPooling: true,
            enableLazyLoading: true,
            enableBatchUpdates: true,
            enableRequestAnimationFrame: true,
            enableMemoryCleanup: true,
            cleanupInterval: 30000, // ms
        };

        // Caches
        this._layoutCache = new Map(); // layoutId -> processed layout
        this._predictionCache = new Map(); // prefix -> suggestions
        this._emojiCache = new Map(); // query -> emoji results
        this._specialCharsCache = new Map(); // category -> characters
        this._themeCache = new Map(); // themeId -> theme CSS
        this._strokeCache = new Map(); // stroke hash -> recognition result
        this._vocabularyCache = new Map(); // vocabulary manager cache

        // LRU tracking
        this._layoutCacheAccess = new Map(); // layoutId -> last access timestamp
        this._predictionCacheAccess = new Map();

        // Object pools
        this._objectPools = new Map(); // className -> pool array

        // Loading promises for lazy loading
        this._loadingPromises = new Map();

        // Performance metrics
        this._metrics = {
            keyPressLatency: [], // rolling window of latencies
            predictionLatency: [],
            gestureRecognitionLatency: [],
            memoryUsage: [],
            cpuUsage: [],
            cacheHitRates: {
                layout: { hits: 0, misses: 0 },
                prediction: { hits: 0, misses: 0 },
                emoji: { hits: 0, misses: 0 },
                theme: { hits: 0, misses: 0 },
                stroke: { hits: 0, misses: 0 },
                vocabulary: { hits: 0, misses: 0 },
            },
            startTime: GLib.get_monotonic_time() / 1000,
            totalKeyPresses: 0,
            totalPredictions: 0,
            totalGestures: 0,
        };

        // Timers
        this._metricsTimerId = 0;
        this._cleanupTimerId = 0;

        // Initialize
        this._setupObjectPools();
        this._startMonitoring();

        log('[betterKeys] PerformanceOptimizer initialized');
    }

    /**
     * Set up object pools for frequently created objects.
     */
    _setupObjectPools() {
        if (!this._config.enableObjectPooling) {
            return;
        }

        // Define poolable object types
        const poolConfigs = [
            { name: 'Point', create: () => ({ x: 0, y: 0 }) },
            { name: 'Rectangle', create: () => ({ x: 0, y: 0, width: 0, height: 0 }) },
            { name: 'GestureData', create: () => ({ type: '', data: {} }) },
            { name: 'Suggestion', create: () => ({ word: '', confidence: 0, type: '' }) },
        ];

        poolConfigs.forEach(config => {
            this._objectPools.set(config.name, {
                pool: [],
                create: config.create,
                maxSize: 100,
            });
        });
    }

    /**
     * Start performance monitoring timers.
     */
    _startMonitoring() {
        if (this._config.enableMetrics) {
            this._metricsTimerId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._config.metricsInterval,
                () => {
                    this._collectMetrics();
                    return true; // continue timer
                }
            );
        }

        if (this._config.enableMemoryCleanup) {
            this._cleanupTimerId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._config.cleanupInterval,
                () => {
                    this._performCleanup();
                    return true;
                }
            );
        }
    }

    /**
     * Stop monitoring and cleanup.
     */
    stop() {
        if (this._metricsTimerId) {
            GLib.source_remove(this._metricsTimerId);
            this._metricsTimerId = 0;
        }
        if (this._cleanupTimerId) {
            GLib.source_remove(this._cleanupTimerId);
            this._cleanupTimerId = 0;
        }
        this.clearAllCaches();
        log('[betterKeys] PerformanceOptimizer stopped');
    }

    /**
     * Collect and log performance metrics.
     */
    _collectMetrics() {
        const now = GLib.get_monotonic_time() / 1000;
        const uptime = now - this._metrics.startTime;

        // Calculate average latencies
        const avgKeyPress = this._average(this._metrics.keyPressLatency);
        const avgPrediction = this._average(this._metrics.predictionLatency);
        const avgGesture = this._average(this._metrics.gestureRecognitionLatency);

        // Calculate cache hit rates
        const layoutHitRate = this._calculateHitRate(this._metrics.cacheHitRates.layout);
        const predictionHitRate = this._calculateHitRate(this._metrics.cacheHitRates.prediction);
        const emojiHitRate = this._calculateHitRate(this._metrics.cacheHitRates.emoji);
        const themeHitRate = this._calculateHitRate(this._metrics.cacheHitRates.theme);

        // Log warnings if targets are missed
        if (this._config.logPerformanceWarnings) {
            if (avgKeyPress > this._config.targetLatencyMs) {
                log(`[betterKeys] Performance warning: Key press latency ${avgKeyPress.toFixed(1)}ms exceeds target ${this._config.targetLatencyMs}ms`);
            }
            if (avgPrediction > this._config.targetPredictionMs) {
                log(`[betterKeys] Performance warning: Prediction latency ${avgPrediction.toFixed(1)}ms exceeds target ${this._config.targetPredictionMs}ms`);
            }
            if (avgGesture > this._config.targetGestureMs) {
                log(`[betterKeys] Performance warning: Gesture recognition latency ${avgGesture.toFixed(1)}ms exceeds target ${this._config.targetGestureMs}ms`);
            }
        }

        // Emit metrics signal
        this.emit('metrics-updated', {
            uptime,
            keyPressLatency: avgKeyPress,
            predictionLatency: avgPrediction,
            gestureLatency: avgGesture,
            layoutCacheHitRate: layoutHitRate,
            predictionCacheHitRate: predictionHitRate,
            emojiCacheHitRate: emojiHitRate,
            themeCacheHitRate: themeHitRate,
            totalKeyPresses: this._metrics.totalKeyPresses,
            totalPredictions: this._metrics.totalPredictions,
            totalGestures: this._metrics.totalGestures,
            memoryUsage: this._getMemoryUsage(),
        });
    }

    /**
     * Calculate average of array.
     */
    _average(arr) {
        if (arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }

    /**
     * Calculate hit rate from hits/misses.
     */
    _calculateHitRate(stat) {
        const total = stat.hits + stat.misses;
        return total > 0 ? stat.hits / total : 0;
    }

    /**
     * Get current memory usage (approximate).
     */
    _getMemoryUsage() {
        // In GNOME Shell we can't directly get memory usage.
        // This is a placeholder that could be enhanced with system calls.
        return 0;
    }

    /**
     * Perform periodic cleanup of caches and object pools.
     */
    _performCleanup() {
        this._cleanupLRUCache(this._layoutCache, this._layoutCacheAccess, this._config.layoutCacheSize);
        this._cleanupLRUCache(this._predictionCache, this._predictionCacheAccess, this._config.predictionCacheSize);
        this._cleanupLRUCache(this._emojiCache, null, this._config.emojiCacheSize);
        this._cleanupLRUCache(this._specialCharsCache, null, this._config.specialCharsCacheSize);
        this._cleanupLRUCache(this._themeCache, null, this._config.themeCacheSize);
        this._cleanupLRUCache(this._strokeCache, null, this._config.strokeRecognitionCacheSize);
        this._cleanupLRUCache(this._vocabularyCache, null, this._config.vocabularyCacheSize);

        // Trim object pools
        for (const [name, poolInfo] of this._objectPools) {
            if (poolInfo.pool.length > poolInfo.maxSize) {
                poolInfo.pool.length = poolInfo.maxSize;
            }
        }

        // Clear old metrics data
        const maxSamples = 1000;
        if (this._metrics.keyPressLatency.length > maxSamples) {
            this._metrics.keyPressLatency = this._metrics.keyPressLatency.slice(-maxSamples);
        }
        if (this._metrics.predictionLatency.length > maxSamples) {
            this._metrics.predictionLatency = this._metrics.predictionLatency.slice(-maxSamples);
        }
        if (this._metrics.gestureRecognitionLatency.length > maxSamples) {
            this._metrics.gestureRecognitionLatency = this._metrics.gestureRecognitionLatency.slice(-maxSamples);
        }

        log('[betterKeys] Performance cleanup completed');
    }

    /**
     * Cleanup LRU cache by removing least recently used entries.
     */
    _cleanupLRUCache(cache, accessMap, maxSize) {
        if (cache.size <= maxSize) {
            return;
        }

        if (!accessMap) {
            // No LRU tracking, just delete random entries
            const excess = cache.size - maxSize;
            const keys = Array.from(cache.keys()).slice(0, excess);
            keys.forEach(key => cache.delete(key));
            return;
        }

        // Sort by access time
        const entries = Array.from(accessMap.entries());
        entries.sort((a, b) => a[1] - b[1]); // ascending timestamp

        const toRemove = entries.slice(0, entries.length - maxSize);
        toRemove.forEach(([key]) => {
            cache.delete(key);
            accessMap.delete(key);
        });
    }

    /**
     * Record a latency measurement.
     */
    recordLatency(type, latencyMs) {
        if (!this._isEnabled) return;

        switch (type) {
            case 'key-press':
                this._metrics.keyPressLatency.push(latencyMs);
                this._metrics.totalKeyPresses++;
                break;
            case 'prediction':
                this._metrics.predictionLatency.push(latencyMs);
                this._metrics.totalPredictions++;
                break;
            case 'gesture':
                this._metrics.gestureRecognitionLatency.push(latencyMs);
                this._metrics.totalGestures++;
                break;
        }
    }

    /**
     * Get an object from pool or create new.
     */
    acquireObject(className, initData = null) {
        if (!this._config.enableObjectPooling) {
            const poolInfo = this._objectPools.get(className);
            if (poolInfo) {
                const obj = poolInfo.create();
                if (initData) Object.assign(obj, initData);
                return obj;
            }
            return null;
        }

        const poolInfo = this._objectPools.get(className);
        if (!poolInfo) {
            logError(`[betterKeys] No object pool for class: ${className}`);
            return null;
        }

        let obj;
        if (poolInfo.pool.length > 0) {
            obj = poolInfo.pool.pop();
        } else {
            obj = poolInfo.create();
        }

        if (initData) {
            Object.assign(obj, initData);
        }

        return obj;
    }

    /**
     * Return object to pool for reuse.
     */
    releaseObject(className, obj) {
        if (!this._config.enableObjectPooling || !obj) {
            return;
        }

        const poolInfo = this._objectPools.get(className);
        if (!poolInfo) {
            return;
        }

        // Reset object properties
        for (const key in obj) {
            if (typeof obj[key] !== 'function') {
                delete obj[key];
            }
        }

        if (poolInfo.pool.length < poolInfo.maxSize) {
            poolInfo.pool.push(obj);
        }
    }

    /**
     * Cache a layout.
     */
    cacheLayout(layoutId, layout) {
        if (!this._isEnabled) return;
        this._layoutCache.set(layoutId, layout);
        this._layoutCacheAccess.set(layoutId, GLib.get_monotonic_time());
        this._metrics.cacheHitRates.layout.misses++; // This is a store, not a hit
    }

    /**
     * Get a cached layout.
     */
    getCachedLayout(layoutId) {
        if (!this._isEnabled) return null;
        if (this._layoutCache.has(layoutId)) {
            this._layoutCacheAccess.set(layoutId, GLib.get_monotonic_time());
            this._metrics.cacheHitRates.layout.hits++;
            return this._layoutCache.get(layoutId);
        }
        this._metrics.cacheHitRates.layout.misses++;
        return null;
    }

    /**
     * Cache prediction results.
     */
    cachePrediction(prefix, suggestions) {
        if (!this._isEnabled) return;
        this._predictionCache.set(prefix, suggestions);
        this._predictionCacheAccess.set(prefix, GLib.get_monotonic_time());
        this._metrics.cacheHitRates.prediction.misses++;
    }

    /**
     * Get cached prediction.
     */
    getCachedPrediction(prefix) {
        if (!this._isEnabled) return null;
        if (this._predictionCache.has(prefix)) {
            this._predictionCacheAccess.set(prefix, GLib.get_monotonic_time());
            this._metrics.cacheHitRates.prediction.hits++;
            return this._predictionCache.get(prefix);
        }
        this._metrics.cacheHitRates.prediction.misses++;
        return null;
    }

    /**
     * Cache emoji search results.
     */
    cacheEmoji(query, results) {
        if (!this._isEnabled) return;
        this._emojiCache.set(query, results);
        this._metrics.cacheHitRates.emoji.misses++;
    }

    /**
     * Get cached emoji results.
     */
    getCachedEmoji(query) {
        if (!this._isEnabled) return null;
        if (this._emojiCache.has(query)) {
            this._metrics.cacheHitRates.emoji.hits++;
            return this._emojiCache.get(query);
        }
        this._metrics.cacheHitRates.emoji.misses++;
        return null;
    }

    /**
     * Cache theme CSS.
     */
    cacheTheme(themeId, css) {
        if (!this._isEnabled) return;
        this._themeCache.set(themeId, css);
        this._metrics.cacheHitRates.theme.misses++;
    }

    /**
     * Get cached theme CSS.
     */
    getCachedTheme(themeId) {
        if (!this._isEnabled) return null;
        if (this._themeCache.has(themeId)) {
            this._metrics.cacheHitRates.theme.hits++;
            return this._themeCache.get(themeId);
        }
        this._metrics.cacheHitRates.theme.misses++;
        return null;
    }

    /**
     * Cache stroke recognition result.
     */
    cacheStroke(hash, result) {
        if (!this._isEnabled) return;
        this._strokeCache.set(hash, result);
    }

    /**
     * Get cached stroke recognition.
     */
    getCachedStroke(hash) {
        if (!this._isEnabled) return null;
        return this._strokeCache.get(hash) || null;
    }

    /**
     * Clear all caches.
     */
    clearAllCaches() {
        this._layoutCache.clear();
        this._layoutCacheAccess.clear();
        this._predictionCache.clear();
        this._predictionCacheAccess.clear();
        this._emojiCache.clear();
        this._specialCharsCache.clear();
        this._themeCache.clear();
        this._strokeCache.clear();
        this._vocabularyCache.clear();

        // Reset cache stats
        for (const stat of Object.values(this._metrics.cacheHitRates)) {
            stat.hits = 0;
            stat.misses = 0;
        }

        log('[betterKeys] All performance caches cleared');
    }

    /**
     * Enable or disable optimizer.
     */
    setEnabled(enabled) {
        this._isEnabled = enabled;
        log(`[betterKeys] Performance optimizer ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get performance metrics.
     * @returns {Object} Metrics object.
     */
    getMetrics() {
        return { ...this._metrics };
    }

    /**
     * Get configuration.
     * @returns {Object} Configuration object.
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Update configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        log('[betterKeys] Performance optimizer configuration updated');
    }

    /**
     * Get cache statistics.
     * @returns {Object} Cache statistics.
     */
    getCacheStats() {
        return {
            layout: {
                size: this._layoutCache.size,
                hits: this._metrics.cacheHitRates.layout.hits,
                misses: this._metrics.cacheHitRates.layout.misses,
            },
            prediction: {
                size: this._predictionCache.size,
                hits: this._metrics.cacheHitRates.prediction.hits,
                misses: this._metrics.cacheHitRates.prediction.misses,
            },
            emoji: {
                size: this._emojiCache.size,
                hits: this._metrics.cacheHitRates.emoji.hits,
                misses: this._metrics.cacheHitRates.emoji.misses,
            },
            theme: {
                size: this._themeCache.size,
                hits: this._metrics.cacheHitRates.theme.hits,
                misses: this._metrics.cacheHitRates.theme.misses,
            },
            stroke: {
                size: this._strokeCache.size,
            },
            vocabulary: {
                size: this._vocabularyCache.size,
            },
        };
    }

    /**
     * Clear a specific cache.
     * @param {string} cacheName - Name of cache ('layout', 'prediction', etc.)
     */
    clearCache(cacheName) {
        switch (cacheName) {
            case 'layout':
                this._layoutCache.clear();
                this._layoutCacheAccess.clear();
                this._metrics.cacheHitRates.layout.hits = 0;
                this._metrics.cacheHitRates.layout.misses = 0;
                break;
            case 'prediction':
                this._predictionCache.clear();
                this._predictionCacheAccess.clear();
                this._metrics.cacheHitRates.prediction.hits = 0;
                this._metrics.cacheHitRates.prediction.misses = 0;
                break;
            case 'emoji':
                this._emojiCache.clear();
                this._metrics.cacheHitRates.emoji.hits = 0;
                this._metrics.cacheHitRates.emoji.misses = 0;
                break;
            case 'theme':
                this._themeCache.clear();
                this._metrics.cacheHitRates.theme.hits = 0;
                this._metrics.cacheHitRates.theme.misses = 0;
                break;
            case 'stroke':
                this._strokeCache.clear();
                break;
            case 'vocabulary':
                this._vocabularyCache.clear();
                break;
            default:
                logError(`[betterKeys] Unknown cache name: ${cacheName}`);
        }
        log(`[betterKeys] Cache cleared: ${cacheName}`);
    }

    /**
     * Batch multiple DOM updates using requestAnimationFrame.
     * @param {Function} updateFn - Function that performs DOM updates.
     */
    batchDOMUpdate(updateFn) {
        if (!this._config.enableBatchUpdates || !this._config.enableRequestAnimationFrame) {
            updateFn();
            return;
        }

        // Use Clutter's timeline for animation frame
        const timeline = new Clutter.Timeline({ duration: 0 });
        timeline.connect('new-frame', () => {
            updateFn();
            timeline.stop();
        });
        timeline.start();
    }

    /**
     * Lazy-load a resource.
     * @param {string} resourceId - Resource identifier.
     * @param {Function} loadFn - Function that loads the resource.
     * @returns {Promise} Promise resolving to the loaded resource.
     */
    lazyLoad(resourceId, loadFn) {
        if (!this._config.enableLazyLoading) {
            return Promise.resolve(loadFn());
        }

        // Check if already loading
        if (this._loadingPromises.has(resourceId)) {
            return this._loadingPromises.get(resourceId);
        }

        // Start loading
        const promise = new Promise((resolve, reject) => {
            try {
                const result = loadFn();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this._loadingPromises.delete(resourceId);
            }
        });

        this._loadingPromises.set(resourceId, promise);
        return promise;
    }
});

// Add signals to the class
PerformanceOptimizer.signals = {
    'metrics-updated': { param_types: [GObject.TYPE_POINTER] },
    'cache-cleared': { param_types: [GObject.TYPE_STRING] },
    'optimizer-enabled': { param_types: [GObject.TYPE_BOOLEAN] },
};
