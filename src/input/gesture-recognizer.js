/* src/input/gesture-recognizer.js - Gesture recognition for swipe, long‑press, pinch */

const { GObject, Clutter, GLib } = imports.gi;

/**
 * GestureRecognizer tracks touch strokes and recognizes gestures
 * such as swipe, long‑press, pinch, etc.
 */
const GestureRecognizer = GObject.registerClass(
class GestureRecognizer extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;

        // Gesture configuration
        this._config = {
            swipeThreshold: 50, // pixels
            swipeVelocityThreshold: 0.5, // pixels/ms
            longPressDuration: 500, // ms
            pinchThreshold: 0.1, // scale factor change
            gestureSensitivity: 1.0, // 0.0 to 2.0
            enableMultiTouch: true,

            // Stroke-based input configuration
            strokeMinLength: 30, // Minimum stroke length in pixels to be considered for recognition
            strokeMaxTime: 800, // Maximum time in ms for a stroke to be completed
            strokeCornerThreshold: 60, // Angle in degrees to detect corners in a stroke (for shape recognition)
            strokeSimplifyTolerance: 5, // Pixels for stroke simplification (RDP algorithm)
            multiStrokeDelay: 200 // Max delay between strokes for continuous gesture typing

        };

        // Active touch tracking
        this._activeTouches = new Map(); // touchId -> { points: [], startTime, startX, startY }

        // Gesture history for debugging
        this._gestureHistory = [];
        this._maxHistorySize = 100;

        // Recognized gesture handlers
        this._gestureHandlers = new Map();

        // Stroke-based input tracking
        this._strokes = []; // Array of completed strokes
        this._currentStroke = null; // Current stroke being drawn
        this._lastStrokeTime = 0; // Time of last completed stroke
        this._strokeRecognitionCache = new Map(); // Cache for recognized strokes

        // Default gesture mappings
        this._setupDefaultMappings();

        log('[betterKeys] GestureRecognizer initialized');
    }

    /**
     * Set up default gesture‑to‑action mappings.
     */
    _setupDefaultMappings() {
        this._gestureHandlers.set('swipe-left', () => {
            this.emit('gesture-detected', 'swipe-left', {});
            log('[betterKeys] Gesture: swipe left');
        });
        this._gestureHandlers.set('swipe-right', () => {
            this.emit('gesture-detected', 'swipe-right', {});
            log('[betterKeys] Gesture: swipe right');
        });
        this._gestureHandlers.set('swipe-up', () => {
            this.emit('gesture-detected', 'swipe-up', {});
            log('[betterKeys] Gesture: swipe up');
        });
        this._gestureHandlers.set('swipe-down', () => {
            this.emit('gesture-detected', 'swipe-down', {});
            log('[betterKeys] Gesture: swipe down');
        });
        this._gestureHandlers.set('long-press', () => {
            this.emit('gesture-detected', 'long-press', {});
            log('[betterKeys] Gesture: long press');
        });
        this._gestureHandlers.set('pinch-in', () => {
            this.emit('gesture-detected', 'pinch-in', {});
            log('[betterKeys] Gesture: pinch in');
        });
        this._gestureHandlers.set('pinch-out', () => {
            this.emit('gesture-detected', 'pinch-out', {});
            log('[betterKeys] Gesture: pinch out');
        });
        this._gestureHandlers.set('double-tap', () => {
            this.emit('gesture-detected', 'double-tap', {});
            log('[betterKeys] Gesture: double tap');
        });
    }

    /**
     * Start gesture recognition.
     */
    start() {
        log('[betterKeys] Gesture recognition started');
    }

    /**
     * Stop gesture recognition and clear state.
     */
    stop() {
        this._activeTouches.clear();
        this._gestureHistory = [];
        log('[betterKeys] Gesture recognition stopped');
    }

    /**
     * Process a touch event from the input handler.
     * @param {number} eventType - Clutter event type (TOUCH_BEGIN, TOUCH_UPDATE, TOUCH_END).
     * @param {number} touchId - Touch identifier.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} pressure - Touch pressure (0‑1).
     */
    processTouchEvent(eventType, touchId, x, y, pressure) {
        const now = GLib.get_monotonic_time() / 1000;

        switch (eventType) {
            case Clutter.EventType.TOUCH_BEGIN:
                this._onTouchBegin(touchId, x, y, pressure, now);
                break;
            case Clutter.EventType.TOUCH_UPDATE:
                this._onTouchUpdate(touchId, x, y, pressure, now);
                break;
            case Clutter.EventType.TOUCH_END:
            case Clutter.EventType.TOUCH_CANCEL:
                this._onTouchEnd(touchId, x, y, pressure, now);
                break;
        }
    }

    /**
     * Handle touch begin.
     */
    _onTouchBegin(touchId, x, y, pressure, time) {
        this._activeTouches.set(touchId, {
            points: [{ x, y, pressure, time }],
            startTime: time,
            startX: x,
            startY: y,
            lastUpdateTime: time,
            velocityX: 0,
            velocityY: 0,
            isLongPressDetected: false,
            longPressTimer: null
        });

        // Start long‑press detection
        const touch = this._activeTouches.get(touchId);
        touch.longPressTimer = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this._config.longPressDuration,
            () => {
                this._detectLongPress(touchId);
                return false; // one‑shot timer
            }
        );

        this._recordGestureEvent('touch-begin', { touchId, x, y });
    }

    /**
     * Handle touch update.
     */
    _onTouchUpdate(touchId, x, y, pressure, time) {
        const touch = this._activeTouches.get(touchId);
        if (!touch) {
            return;
        }

        // Update velocity
        const dt = time - touch.lastUpdateTime;
        if (dt > 0) {
            const lastPoint = touch.points[touch.points.length - 1];
            touch.velocityX = (x - lastPoint.x) / dt;
            touch.velocityY = (y - lastPoint.y) / dt;
        }

        // Add point to history
        touch.points.push({ x, y, pressure, time });
        touch.lastUpdateTime = time;

        // Limit points history to avoid memory bloat
        if (touch.points.length > 100) {
            touch.points.shift();
        }

        // Cancel long‑press timer if movement exceeds threshold
        if (this._distance(x, y, touch.startX, touch.startY) > 10) {
            if (touch.longPressTimer) {
                GLib.source_remove(touch.longPressTimer);
                touch.longPressTimer = null;
            }
        }

        // Detect swipe in progress
        this._detectSwipe(touchId);

        // Detect pinch if multi‑touch
        if (this._activeTouches.size >= 2) {
            this._detectPinch();
        }

        this._recordGestureEvent('touch-update', { touchId, x, y });
    }

    /**
     * Handle touch end.
     */
    _onTouchEnd(touchId, x, y, pressure, time) {
        const touch = this._activeTouches.get(touchId);
        if (!touch) {
            return;
        }

        // Cancel long‑press timer
        if (touch.longPressTimer) {
            GLib.source_remove(touch.longPressTimer);
            touch.longPressTimer = null;
        }

        // Finalize gesture detection
        this._finalizeSwipe(touchId);
        this._detectDoubleTap(touchId, time);

        // Clean up
        this._activeTouches.delete(touchId);

        this._recordGestureEvent('touch-end', { touchId, x, y });
    }

    /**
     * Detect long‑press gesture.
     */
    _detectLongPress(touchId) {
        const touch = this._activeTouches.get(touchId);
        if (!touch || touch.isLongPressDetected) {
            return;
        }

        // Ensure minimal movement
        const currentPoint = touch.points[touch.points.length - 1];
        const distance = this._distance(currentPoint.x, currentPoint.y, touch.startX, touch.startY);
        if (distance > 20) {
            return;
        }

        touch.isLongPressDetected = true;
        this._triggerGesture('long-press', {
            touchId,
            x: touch.startX,
            y: touch.startY,
            duration: this._config.longPressDuration
        });
    }

    /**
     * Detect swipe gesture while touch is moving.
     */
    _detectSwipe(touchId) {
        const touch = this._activeTouches.get(touchId);
        if (!touch || touch.points.length < 2) {
            return;
        }

        const first = touch.points[0];
        const last = touch.points[touch.points.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if threshold exceeded
        if (distance >= this._config.swipeThreshold) {
            const velocity = Math.sqrt(touch.velocityX * touch.velocityX + touch.velocityY * touch.velocityY);

            if (velocity >= this._config.swipeVelocityThreshold) {
                let direction = '';
                if (Math.abs(dx) > Math.abs(dy)) {
                    direction = dx > 0 ? 'swipe-right' : 'swipe-left';
                } else {
                    direction = dy > 0 ? 'swipe-down' : 'swipe-up';
                }

                this._triggerGesture(direction, {
                    touchId,
                    startX: first.x,
                    startY: first.y,
                    endX: last.x,
                    endY: last.y,
                    distance,
                    velocity
                });

                // Reset start point to avoid repeated detection
                touch.startX = last.x;
                touch.startY = last.y;
                touch.points = [last];
            }
        }
    }

    /**
     * Finalize swipe detection on touch end.
     */
    _finalizeSwipe(touchId) {
        const touch = this._activeTouches.get(touchId);
        if (!touch || touch.points.length < 2) {
            return;
        }

        const first = touch.points[0];
        const last = touch.points[touch.points.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= this._config.swipeThreshold * 0.7) {
            let direction = '';
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'swipe-right' : 'swipe-left';
            } else {
                direction = dy > 0 ? 'swipe-down' : 'swipe-up';
            }

            this._triggerGesture(direction, {
                touchId,
                startX: first.x,
                startY: first.y,
                endX: last.x,
                endY: last.y,
                distance,
                final: true
            });
        }
    }

    /**
     * Detect pinch gesture (requires two touches).
     */
    _detectPinch() {
        if (this._activeTouches.size < 2) {
            return;
        }

        const touches = Array.from(this._activeTouches.values());
        if (touches.length < 2) {
            return;
        }

        const t1 = touches[0];
        const t2 = touches[1];
        if (t1.points.length < 2 || t2.points.length < 2) {
            return;
        }

        const first1 = t1.points[0];
        const last1 = t1.points[t1.points.length - 1];
        const first2 = t2.points[0];
        const last2 = t2.points[t2.points.length - 1];

        const initialDistance = this._distance(first1.x, first1.y, first2.x, first2.y);
        const currentDistance = this._distance(last1.x, last1.y, last2.x, last2.y);

        const scaleChange = currentDistance / initialDistance;
        const threshold = this._config.pinchThreshold;

        if (Math.abs(1 - scaleChange) > threshold) {
            const gesture = scaleChange < 1 ? 'pinch-in' : 'pinch-out';
            this._triggerGesture(gesture, {
                scaleChange,
                centerX: (last1.x + last2.x) / 2,
                centerY: (last1.y + last2.y) / 2
            });
        }
    }

    /**
     * Detect double‑tap gesture.
     */
    _detectDoubleTap(touchId, _endTime) {
        // This is a simplified implementation; a real one would track
        // previous tap timing and position.
        // For now, we'll just log.
        this._recordGestureEvent('tap', { touchId });
    }

    /**
     * Trigger a gesture action.
     * @param {string} gestureName - Gesture identifier.
     * @param {Object} data - Gesture data.
     */
    _triggerGesture(gestureName, data) {
        // Call registered handler
        const handler = this._gestureHandlers.get(gestureName);
        if (handler) {
            handler(data);
        }

        // Emit signal
        this.emit('gesture', gestureName, data);

        // Record in history
        this._recordGestureEvent('gesture', { gestureName, ...data });
    }

    /**
     * Record an event in gesture history.
     */
    _recordGestureEvent(type, data) {
        const entry = {
            time: GLib.get_monotonic_time() / 1000,
            type,
            data
        };

        this._gestureHistory.push(entry);
        if (this._gestureHistory.length > this._maxHistorySize) {
            this._gestureHistory.shift();
        }
    }

    /**
     * Calculate Euclidean distance between two points.
     */
    _distance(x1, y1, x2, y2) {
        const dx = x1 - x2;
        const dy = y1 - y2;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Register a custom gesture handler.
     * @param {string} gestureName - Gesture identifier.
     * @param {Function} handler - Callback function.
     */
    registerGestureHandler(gestureName, handler) {
        this._gestureHandlers.set(gestureName, handler);
        log(`[betterKeys] Registered handler for gesture: ${gestureName}`);
    }

    /**
     * Unregister a gesture handler.
     */
    unregisterGestureHandler(gestureName) {
        this._gestureHandlers.delete(gestureName);
        log(`[betterKeys] Unregistered handler for gesture: ${gestureName}`);
    }

    /**
     * Update gesture configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        log('[betterKeys] Gesture configuration updated');
    }

    /**
     * Get current gesture configuration.
     * @returns {Object} Configuration object.
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Get gesture history (for debugging).
     * @returns {Array} History entries.
     */
    getGestureHistory() {
        return [...this._gestureHistory];
    }

    /**
     * Clear gesture history.
     */
    clearHistory() {
        this._gestureHistory = [];
        log('[betterKeys] Gesture history cleared');
    }

    /**
     * Get active touch count.
     * @returns {number} Number of active touches.
     */
    getActiveTouchCount() {
        return this._activeTouches.size;
    }

    /**
     * Start a new stroke for gesture typing.
     * @param {number} x - Starting X coordinate.
     * @param {number} y - Starting Y coordinate.
     * @param {number} time - Timestamp.
     */
    startStroke(x, y, time) {
        this._currentStroke = {
            points: [{ x, y, time }],
            startTime: time,
            startX: x,
            startY: y,
            confidence: 1.0
        };
    }

    /**
     * Add a point to the current stroke.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} time - Timestamp.
     */
    addStrokePoint(x, y, time) {
        if (!this._currentStroke) {
            this.startStroke(x, y, time);
            return;
        }

        this._currentStroke.points.push({ x, y, time });

        // Limit points to avoid memory bloat
        if (this._currentStroke.points.length > 200) {
            this._currentStroke.points.shift();
        }
    }

    /**
     * Complete the current stroke and attempt recognition.
     * @param {number} time - Timestamp.
     * @returns {Object} Recognition result with character and confidence.
     */
    completeStroke(time) {
        if (!this._currentStroke || this._currentStroke.points.length < 2) {
            this._currentStroke = null;
            return null;
        }

        const stroke = this._currentStroke;
        stroke.endTime = time;
        stroke.duration = time - stroke.startTime;

        // Check if stroke is valid
        const strokeLength = this._calculateStrokeLength(stroke.points);
        if (strokeLength < this._config.strokeMinLength) {
            this._currentStroke = null;
            return null;
        }

        if (stroke.duration > this._config.strokeMaxTime) {
            this._currentStroke = null;
            return null;
        }

        // Simplify stroke using Ramer-Douglas-Peucker algorithm
        const simplifiedPoints = this._simplifyStroke(stroke.points, this._config.strokeSimplifyTolerance);
        stroke.simplifiedPoints = simplifiedPoints;

        // Recognize the stroke
        const result = this._recognizeStroke(stroke);

        // Store stroke
        this._strokes.push(stroke);
        this._lastStrokeTime = time;

        // Limit stroke history
        if (this._strokes.length > 50) {
            this._strokes.shift();
        }

        this._currentStroke = null;
        return result;
    }

    /**
     * Calculate the total length of a stroke.
     * @param {Array} points - Array of points.
     * @returns {number} Total stroke length in pixels.
     */
    _calculateStrokeLength(points) {
        if (points.length < 2) return 0;

        let length = 0;
        for (let i = 1; i < points.length; i++) {
            length += this._distance(points[i].x, points[i].y, points[i - 1].x, points[i - 1].y);
        }
        return length;
    }

    /**
     * Simplify a stroke using Ramer-Douglas-Peucker algorithm.
     * @param {Array} points - Array of points.
     * @param {number} tolerance - Simplification tolerance in pixels.
     * @returns {Array} Simplified points.
     */
    _simplifyStroke(points, tolerance) {
        if (points.length < 3) return points;

        const simplified = [];
        let maxDistance = 0;
        let maxIndex = 0;

        // Find point with maximum distance from line
        const start = points[0];
        const end = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const distance = this._pointToLineDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        // If max distance is greater than tolerance, recursively simplify
        if (maxDistance > tolerance) {
            const left = this._simplifyStroke(points.slice(0, maxIndex + 1), tolerance);
            const right = this._simplifyStroke(points.slice(maxIndex), tolerance);
            simplified.push(...left.slice(0, -1), ...right);
        } else {
            simplified.push(start, end);
        }

        return simplified;
    }

    /**
     * Calculate perpendicular distance from point to line.
     * @param {Object} point - Point with x, y properties.
     * @param {Object} lineStart - Line start point.
     * @param {Object} lineEnd - Line end point.
     * @returns {number} Distance in pixels.
     */
    _pointToLineDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const denominator = Math.sqrt(dx * dx + dy * dy);

        if (denominator === 0) {
            return this._distance(point.x, point.y, lineStart.x, lineStart.y);
        }

        const numerator = Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
        return numerator / denominator;
    }

    /**
     * Recognize a stroke and return the most likely character.
     * @param {Object} stroke - Stroke object with points.
     * @returns {Object} Recognition result { character, confidence, alternatives }.
     */
    _recognizeStroke(stroke) {
        // Check cache first
        const cacheKey = this._generateStrokeHash(stroke);
        if (this._strokeRecognitionCache.has(cacheKey)) {
            return this._strokeRecognitionCache.get(cacheKey);
        }

        // Simple stroke recognition based on direction and shape
        const result = this._classifyStrokeShape(stroke);

        // Cache the result
        this._strokeRecognitionCache.set(cacheKey, result);

        // Limit cache size
        if (this._strokeRecognitionCache.size > 100) {
            const firstKey = this._strokeRecognitionCache.keys().next().value;
            this._strokeRecognitionCache.delete(firstKey);
        }

        return result;
    }

    /**
     * Generate a hash for a stroke for caching.
     * @param {Object} stroke - Stroke object.
     * @returns {string} Hash string.
     */
    _generateStrokeHash(stroke) {
        if (!stroke.simplifiedPoints || stroke.simplifiedPoints.length === 0) {
            return 'empty';
        }

        const points = stroke.simplifiedPoints;
        const start = points[0];
        const end = points[points.length - 1];

        return `${Math.round(start.x)}_${Math.round(start.y)}_${Math.round(end.x)}_${Math.round(end.y)}_${points.length}`;
    }

    /**
     * Classify stroke shape and return recognized character.
     * @param {Object} stroke - Stroke object.
     * @returns {Object} Recognition result.
     */
    _classifyStrokeShape(stroke) {
        const points = stroke.simplifiedPoints || stroke.points;
        if (points.length < 2) {
            return { character: null, confidence: 0, alternatives: [] };
        }

        const start = points[0];
        const end = points[points.length - 1];
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const normalizedAngle = (angle + 360) % 360;

        // Simple direction-based recognition
        let character = null;
        let confidence = 0.5;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal stroke
            if (dx > 0) {
                character = 'right'; // Swipe right
                confidence = 0.8;
            } else {
                character = 'left'; // Swipe left
                confidence = 0.8;
            }
        } else {
            // Vertical stroke
            if (dy > 0) {
                character = 'down'; // Swipe down
                confidence = 0.8;
            } else {
                character = 'up'; // Swipe up
                confidence = 0.8;
            }
        }

        return {
            character,
            confidence,
            alternatives: [],
            metadata: {
                angle: normalizedAngle,
                distance,
                duration: stroke.duration,
                pointCount: points.length
            }
        };
    }

    /**
     * Get the current stroke being drawn.
     * @returns {Object} Current stroke or null.
     */
    getCurrentStroke() {
        return this._currentStroke;
    }

    /**
     * Get all completed strokes.
     * @returns {Array} Array of stroke objects.
     */
    getStrokes() {
        return [...this._strokes];
    }

    /**
     * Clear all strokes.
     */
    clearStrokes() {
        this._strokes = [];
        this._currentStroke = null;
        this._strokeRecognitionCache.clear();
        log('[betterKeys] Strokes cleared');
    }

    /**
     * Check if a new stroke can be started (multi-stroke support).
     * @param {number} currentTime - Current timestamp.
     * @returns {boolean} True if enough time has passed since last stroke.
     */
    canStartNewStroke(currentTime) {
        return (currentTime - this._lastStrokeTime) < this._config.multiStrokeDelay;
    }

    /**
     * Get stroke statistics for debugging.
     * @returns {Object} Statistics object.
     */
    getStrokeStats() {
        return {
            totalStrokes: this._strokes.length,
            currentStroke: this._currentStroke ? {
                points: this._currentStroke.points.length,
                duration: this._currentStroke.endTime ? this._currentStroke.endTime - this._currentStroke.startTime : 0
            } : null,
            cacheSize: this._strokeRecognitionCache.size,
            lastStrokeTime: this._lastStrokeTime
        };
    }
});

// Add signals to the class
GestureRecognizer.signals = {
    'gesture': { param_types: [GObject.TYPE_STRING, GObject.TYPE_POINTER] },
    'gesture-detected': { param_types: [GObject.TYPE_STRING, GObject.TYPE_POINTER] }
};

// Export the GestureRecognizer class (already defined as GestureRecognizer)
// var GestureRecognizer = GestureRecognizer; // Removed duplicate declaration
