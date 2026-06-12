/* src/ui/animations.js - Visual effects and animations for betterKeys */

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';

/**
 * Animation manager for coordinating visual effects across the keyboard.
 */
export const AnimationManager = GObject.registerClass(
class AnimationManager extends GObject.Object {
    _init() {
        super._init();

        this._animations = new Map(); // id -> animation object
        this._nextId = 1;
        this._isRunning = false;
        this._animationLoopId = 0;

        log('[betterKeys] AnimationManager initialized');
    }

    /**
     * Start the animation loop.
     */
    start() {
        if (this._isRunning) return;

        this._isRunning = true;
        this._animationLoopId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            this._updateAnimations();
            return GLib.SOURCE_CONTINUE;
        });

        log('[betterKeys] Animation loop started');
    }

    /**
     * Stop the animation loop.
     */
    stop() {
        if (!this._isRunning) return;

        if (this._animationLoopId) {
            GLib.source_remove(this._animationLoopId);
            this._animationLoopId = 0;
        }

        this._isRunning = false;
        log('[betterKeys] Animation loop stopped');
    }

    _updateAnimations() {
        const now = Date.now();
        for (const [id, animation] of this._animations.entries()) {
            const elapsed = now - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1.0);

            // Update animation
            if (animation.update) {
                animation.update(progress, animation);
            }

            // Check if animation is complete
            if (progress >= 1.0) {
                if (animation.complete) {
                    animation.complete(animation);
                }
                this._animations.delete(id);
            }
        }
    }

    /**
     * Register a new animation.
     * @param {Object} config - Animation configuration.
     * @param {Function} config.update - Callback(progress, animation) called each frame.
     * @param {Function} config.complete - Callback(animation) when animation finishes.
     * @param {number} config.duration - Duration in milliseconds.
     * @param {*} config.data - Custom data attached to animation.
     * @returns {number} Animation ID.
     */
    addAnimation(config) {
        const id = this._nextId++;
        const animation = {
            id,
            startTime: Date.now(),
            duration: config.duration || 300,
            update: config.update || null,
            complete: config.complete || null,
            data: config.data || null
        };

        this._animations.set(id, animation);
        return id;
    }

    /**
     * Remove an animation by ID.
     * @param {number} id - Animation ID.
     */
    removeAnimation(id) {
        this._animations.delete(id);
    }

    /**
     * Create a key press animation for a specific key.
     * @param {St.Widget} key - The key actor.
     * @param {Object} options - Animation options.
     * @returns {number} Animation ID.
     */
    animateKeyPress(key, options = {}) {
        const scale = options.scale || 0.9;
        const duration = options.duration || 150;
        const easing = options.easing || Clutter.AnimationMode.EASE_OUT_QUAD;

        // Store original scale
        const originalScaleX = key.scale_x;
        const originalScaleY = key.scale_y;

        // Apply pressed style class
        key.add_style_class_name('betterkeys-key-press-animation');

        // Animate scale
        key.ease({
            scale_x: scale,
            scale_y: scale,
            duration: duration / 2,
            mode: easing,
            onComplete: () => {
                key.ease({
                    scale_x: originalScaleX,
                    scale_y: originalScaleY,
                    duration: duration / 2,
                    mode: easing,
                    onComplete: () => {
                        key.remove_style_class_name('betterkeys-key-press-animation');
                    }
                });
            }
        });

        // Also register in our manager for tracking
        return this.addAnimation({
            duration,
            data: { key }
        });
    }

    /**
     * Create a ripple effect animation at coordinates.
     * @param {St.Widget} parent - Parent actor.
     * @param {number} x - X coordinate relative to parent.
     * @param {number} y - Y coordinate relative to parent.
     * @param {Object} options - Animation options.
     * @returns {number} Animation ID.
     */
    animateRipple(parent, x, y, options = {}) {
        const radius = options.radius || 50;
        const duration = options.duration || 400;

        const ripple = new St.Widget({
            style_class: 'betterkeys-ripple',
            width: 0,
            height: 0,
            x: x,
            y: y,
            opacity: 255
        });

        parent.add_child(ripple);

        // Animate expansion and fade
        ripple.ease({
            width: radius * 2,
            height: radius * 2,
            x: x - radius,
            y: y - radius,
            opacity: 0,
            duration: duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                parent.remove_child(ripple);
                ripple.destroy();
            }
        });

        return this.addAnimation({
            duration,
            data: { ripple }
        });
    }

    /**
     * Animate keyboard show/hide transition.
     * @param {St.Widget} keyboard - Keyboard widget.
     * @param {string} direction - 'show' or 'hide'.
     * @param {Object} options - Animation options.
     */
    animateKeyboardTransition(keyboard, direction, options = {}) {
        const duration = options.duration || 250;
        const easing = options.easing || Clutter.AnimationMode.EASE_OUT_QUAD;
        const startY = keyboard.y;
        const targetY = direction === 'show' ? startY : startY + 100;

        // Set initial state
        if (direction === 'show') {
            keyboard.opacity = 0;
            keyboard.y = startY + 50;
            keyboard.show();
        }

        // Animate
        keyboard.ease({
            opacity: direction === 'show' ? 255 : 0,
            y: targetY,
            duration: duration,
            mode: easing,
            onComplete: () => {
                if (direction === 'hide') {
                    keyboard.hide();
                }
                if (options.onComplete) {
                    options.onComplete();
                }
            }
        });
    }

    /**
     * Animate a swipe gesture visualization.
     * @param {St.Widget} parent - Parent actor.
     * @param {number} startX - Start X.
     * @param {number} startY - Start Y.
     * @param {number} endX - End X.
     * @param {number} endY - End Y.
     * @param {Object} options - Animation options.
     * @returns {number} Animation ID.
     */
    animateSwipe(parent, startX, startY, endX, endY, options = {}) {
        const width = options.width || 8;
        const duration = options.duration || 300;

        const line = new St.Widget({
            style_class: 'betterkeys-swipe-line',
            x: startX,
            y: startY,
            width: 0,
            height: width,
            opacity: 255,
            rotation_angle_z: 0
        });

        parent.add_child(line);

        // Calculate angle and length
        const dx = endX - startX;
        const dy = endY - startY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Animate length and fade
        line.ease({
            width: length,
            rotation_angle_z: angle,
            opacity: 0,
            duration: duration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                parent.remove_child(line);
                line.destroy();
            }
        });

        return this.addAnimation({
            duration,
            data: { line }
        });
    }

    /**
     * Create a bounce animation for a widget.
     * @param {St.Widget} widget - The widget to animate.
     * @param {Object} options - Animation options.
     */
    animateBounce(widget, options = {}) {
        const scale = options.scale || 1.1;
        const duration = options.duration || 300;
        const easing = Clutter.AnimationMode.EASE_OUT_BOUNCE;

        const originalScaleX = widget.scale_x;
        const originalScaleY = widget.scale_y;

        widget.ease({
            scale_x: scale,
            scale_y: scale,
            duration: duration,
            mode: easing,
            onComplete: () => {
                widget.ease({
                    scale_x: originalScaleX,
                    scale_y: originalScaleY,
                    duration: duration,
                    mode: easing
                });
            }
        });
    }

    /**
     * Create a color transition animation.
     * @param {St.Widget} widget - The widget.
     * @param {string} styleProperty - CSS property to transition (e.g., 'background-color').
     * @param {string} fromColor - Starting color (hex).
     * @param {string} toColor - Ending color (hex).
     * @param {Object} options - Animation options.
     */
    animateColorTransition(widget, styleProperty, fromColor, toColor, options = {}) {
        // This is a simplified implementation; in practice you'd use CSS transitions
        // or animate Clutter.Color via shaders. For now, we'll rely on CSS classes.
        const duration = options.duration || 200;

        // Add transition class
        widget.add_style_class_name('betterkeys-color-transition');

        // Set initial color via inline style (if needed)
        // This is a placeholder; actual implementation would depend on styling system.

        // After duration, remove class
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            widget.remove_style_class_name('betterkeys-color-transition');
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Create a gesture stroke visualization.
     * @param {St.Widget} parent - Parent actor.
     * @param {Array} points - Array of {x, y} points.
     * @param {Object} options - Visualization options.
     * @returns {Object} Visualization controller with update and destroy methods.
     */
    createGestureStroke(parent, points = [], options = {}) {
        const color = options.color || new Clutter.Color({ red: 100, green: 180, blue: 255, alpha: 200 });
        const strokeWidth = options.strokeWidth || 6;
        const fadeDuration = options.fadeDuration || 500;
        const smoothing = options.smoothing !== false;

        // Create a container for stroke segments
        const container = new St.Widget({
            style_class: 'betterkeys-gesture-stroke',
            x: 0,
            y: 0,
            width: 0,
            height: 0
        });
        parent.add_child(container);

        // Store segments for updating
        const segments = [];
        let currentPoints = [...points];

        /**
         * Update the stroke with new points.
         * @param {Array} newPoints - Additional points.
         */
        const update = (newPoints) => {
            if (!newPoints || newPoints.length === 0) return;

            currentPoints.push(...newPoints);

            // Create a new segment for the new points
            if (currentPoints.length >= 2) {
                const segment = this._createStrokeSegment(container, currentPoints, {
                    color,
                    strokeWidth,
                    smoothing
                });
                segments.push(segment);

                // Limit number of segments for performance
                if (segments.length > 20) {
                    const old = segments.shift();
                    if (old && old.actor) {
                        container.remove_child(old.actor);
                        old.actor.destroy();
                    }
                }
            }
        };

        /**
         * Complete the stroke and fade out.
         * @param {number} confidence - Confidence score (0-1).
         */
        const complete = (confidence = 1.0) => {
            // Visualize confidence with color
            let confidenceColor = color;
            if (confidence < 0.5) {
                confidenceColor = new Clutter.Color({ red: 255, green: 100, blue: 100, alpha: 200 });
            } else if (confidence < 0.8) {
                confidenceColor = new Clutter.Color({ red: 255, green: 200, blue: 100, alpha: 200 });
            }

            // Update all segments to confidence color
            segments.forEach(segment => {
                if (segment.actor) {
                    segment.actor.style = `background-color: rgba(${confidenceColor.red}, ${confidenceColor.green}, ${confidenceColor.blue}, ${confidenceColor.alpha / 255});`;
                }
            });

            // Fade out animation
            container.ease({
                opacity: 0,
                duration: fadeDuration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    parent.remove_child(container);
                    container.destroy();
                }
            });
        };

        /**
         * Immediately destroy the visualization.
         */
        const destroy = () => {
            if (container && container.get_parent()) {
                parent.remove_child(container);
                container.destroy();
            }
        };

        // Initialize with existing points
        if (currentPoints.length >= 2) {
            update([]); // This will create initial segment
        }

        return {
            update,
            complete,
            destroy,
            container
        };
    }

    /**
     * Create a single stroke segment from points.
     * @private
     */
    _createStrokeSegment(parent, points, options) {
        if (points.length < 2) return null;

        const color = options.color;
        const strokeWidth = options.strokeWidth;
        const smoothing = options.smoothing;

        // Apply smoothing if requested
        let smoothedPoints = points;
        if (smoothing && points.length > 2) {
            smoothedPoints = this._smoothPoints(points);
        }

        // Create a line actor
        const line = new St.Widget({
            style_class: 'betterkeys-gesture-segment',
            x: smoothedPoints[0].x,
            y: smoothedPoints[0].y,
            width: 0,
            height: strokeWidth,
            opacity: 255
        });

        // Calculate angle and length
        const lastPoint = smoothedPoints[smoothedPoints.length - 1];
        const dx = lastPoint.x - smoothedPoints[0].x;
        const dy = lastPoint.y - smoothedPoints[0].y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // Set initial properties
        line.width = length;
        line.rotation_angle_z = angle;
        line.style = `background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255}); border-radius: ${strokeWidth / 2}px;`;

        parent.add_child(line);

        // Animate appearance
        line.opacity = 0;
        line.ease({
            opacity: 255,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });

        return {
            actor: line,
            points: smoothedPoints
        };
    }

    /**
     * Simple point smoothing using moving average.
     * @private
     */
    _smoothPoints(points, windowSize = 3) {
        if (points.length <= windowSize) return points;

        const smoothed = [];
        for (let i = 0; i < points.length; i++) {
            let sumX = 0;
            let sumY = 0;
            let count = 0;

            for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
                sumX += points[j].x;
                sumY += points[j].y;
                count++;
            }

            smoothed.push({
                x: sumX / count,
                y: sumY / count
            });
        }

        return smoothed;
    }

    /**
     * Visualize gesture confidence as a radial indicator.
     * @param {St.Widget} parent - Parent actor.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @param {number} confidence - Confidence score (0-1).
     * @param {Object} options - Visualization options.
     * @returns {Object} Confidence indicator controller.
     */
    createConfidenceIndicator(parent, x, y, confidence, options = {}) {
        const size = options.size || 40;
        const duration = options.duration || 800;

        const container = new St.Widget({
            style_class: 'betterkeys-confidence-indicator',
            x: x - size / 2,
            y: y - size / 2,
            width: size,
            height: size,
            opacity: 255
        });
        parent.add_child(container);

        // Create outer ring
        const outerRing = new St.Widget({
            style_class: 'betterkeys-confidence-outer',
            width: size,
            height: size,
            opacity: 100
        });
        outerRing.style = `
            border: 3px solid rgba(200, 200, 200, 0.5);
            border-radius: 50%;
        `;
        container.add_child(outerRing);

        // Create inner fill based on confidence
        const innerFill = new St.Widget({
            style_class: 'betterkeys-confidence-inner',
            width: size * 0.7,
            height: size * 0.7,
            x: size * 0.15,
            y: size * 0.15,
            opacity: 200
        });

        // Set color based on confidence
        let color;
        if (confidence >= 0.8) {
            color = 'rgba(100, 255, 100, 0.8)'; // Green
        } else if (confidence >= 0.5) {
            color = 'rgba(255, 255, 100, 0.8)'; // Yellow
        } else {
            color = 'rgba(255, 100, 100, 0.8)'; // Red
        }

        innerFill.style = `
            background-color: ${color};
            border-radius: 50%;
        `;
        container.add_child(innerFill);

        // Animate pulse
        const pulse = () => {
            innerFill.ease({
                scale_x: 1.2,
                scale_y: 1.2,
                duration: duration / 2,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    innerFill.ease({
                        scale_x: 1.0,
                        scale_y: 1.0,
                        duration: duration / 2,
                        mode: Clutter.AnimationMode.EASE_IN_QUAD,
                        onComplete: pulse
                    });
                }
            });
        };
        pulse();

        // Fade out and destroy after duration
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            container.ease({
                opacity: 0,
                duration: 300,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    parent.remove_child(container);
                    container.destroy();
                }
            });
            return GLib.SOURCE_REMOVE;
        });

        return {
            updateConfidence: (newConfidence) => {
                // Update inner fill color based on new confidence
                let newColor;
                if (newConfidence >= 0.8) {
                    newColor = 'rgba(100, 255, 100, 0.8)';
                } else if (newConfidence >= 0.5) {
                    newColor = 'rgba(255, 255, 100, 0.8)';
                } else {
                    newColor = 'rgba(255, 100, 100, 0.8)';
                }
                innerFill.style = `background-color: ${newColor}; border-radius: 50%;`;
            },
            destroy: () => {
                if (container && container.get_parent()) {
                    parent.remove_child(container);
                    container.destroy();
                }
            }
        };
    }

    /**
     * Create a gesture trail that follows the mouse/finger.
     * @param {St.Widget} parent - Parent actor.
     * @param {Object} options - Trail options.
     * @returns {Object} Trail controller.
     */
    createGestureTrail(parent, options = {}) {
        const trailLength = options.trailLength || 20;
        const particleSize = options.particleSize || 8;
        const color = options.color || new Clutter.Color({ red: 150, green: 200, blue: 255, alpha: 150 });
        const fadeSpeed = options.fadeSpeed || 0.1;

        const particles = [];
        const container = new St.Widget({
            style_class: 'betterkeys-gesture-trail',
            x: 0,
            y: 0,
            width: 0,
            height: 0
        });
        parent.add_child(container);

        /**
         * Add a new point to the trail.
         * @param {number} x - X coordinate.
         * @param {number} y - Y coordinate.
         */
        const addPoint = (x, y) => {
            // Create new particle
            const particle = new St.Widget({
                style_class: 'betterkeys-trail-particle',
                x: x - particleSize / 2,
                y: y - particleSize / 2,
                width: particleSize,
                height: particleSize,
                opacity: 255
            });
            particle.style = `background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255}); border-radius: 50%;`;
            container.add_child(particle);

            particles.push({
                actor: particle,
                age: 0,
                x,
                y
            });

            // Limit trail length
            if (particles.length > trailLength) {
                const old = particles.shift();
                if (old && old.actor) {
                    container.remove_child(old.actor);
                    old.actor.destroy();
                }
            }
        };

        /**
         * Update trail animation.
         */
        const update = () => {
            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                particle.age += fadeSpeed;

                if (particle.age >= 1.0) {
                    // Remove dead particle
                    container.remove_child(particle.actor);
                    particle.actor.destroy();
                    particles.splice(i, 1);
                } else {
                    // Update opacity and size
                    const opacity = Math.floor(255 * (1 - particle.age));
                    const scale = 1.0 - particle.age * 0.5;

                    particle.actor.opacity = opacity;
                    particle.actor.scale_x = scale;
                    particle.actor.scale_y = scale;
                }
            }
        };

        // Start update loop
        const updateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            update();
            return GLib.SOURCE_CONTINUE;
        });

        return {
            addPoint,
            destroy: () => {
                if (updateId) {
                    GLib.source_remove(updateId);
                }
                if (container && container.get_parent()) {
                    parent.remove_child(container);
                    container.destroy();
                }
                // Clean up particles
                particles.forEach(p => {
                    if (p.actor) {
                        p.actor.destroy();
                    }
                });
                particles.length = 0;
            }
        };
    }

    /**
     * Visualize stroke smoothing by showing original vs smoothed path.
     * @param {St.Widget} parent - Parent actor.
     * @param {Array} originalPoints - Original points.
     * @param {Array} smoothedPoints - Smoothed points.
     * @param {Object} options - Visualization options.
     */
    visualizeSmoothing(parent, originalPoints, smoothedPoints, options = {}) {
        if (originalPoints.length < 2 || smoothedPoints.length < 2) return;

        const duration = options.duration || 2000;
        const originalColor = options.originalColor || new Clutter.Color({ red: 255, green: 100, blue: 100, alpha: 150 });
        const smoothedColor = options.smoothedColor || new Clutter.Color({ red: 100, green: 255, blue: 100, alpha: 150 });
        const lineWidth = options.lineWidth || 4;

        // Draw original path
        this._drawPath(parent, originalPoints, {
            color: originalColor,
            width: lineWidth,
            dash: [5, 3] // Dashed line for original
        });

        // Draw smoothed path
        this._drawPath(parent, smoothedPoints, {
            color: smoothedColor,
            width: lineWidth,
            dash: null // Solid line for smoothed
        });

        // Fade out after duration
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, duration, () => {
            // In a real implementation, we'd track and remove the path actors
            // For simplicity, we'll just log
            log('[betterKeys] Smoothing visualization completed');
            return GLib.SOURCE_REMOVE;
        });
    }

    /**
     * Draw a path from points.
     * @private
     */
    _drawPath(parent, points, options) {
        if (points.length < 2) return;

        const color = options.color;
        const width = options.width || 4;
        const dash = options.dash;

        // For each segment, draw a line
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            const line = new St.Widget({
                style_class: 'betterkeys-path-segment',
                x: p1.x,
                y: p1.y,
                width: length,
                height: width,
                rotation_angle_z: angle,
                opacity: 200
            });

            let style = `background-color: rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255});`;
            if (dash) {
                style += ` border: ${width}px dashed rgba(${color.red}, ${color.green}, ${color.blue}, ${color.alpha / 255});`;
            }
            line.style = style;

            parent.add_child(line);

            // Fade out after a while
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
                line.ease({
                    opacity: 0,
                    duration: 500,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        if (line.get_parent()) {
                            parent.remove_child(line);
                            line.destroy();
                        }
                    }
                });
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    /**
     * Stop all animations.
     */
    clearAll() {
        this._animations.clear();
    }

    destroy() {
        this.stop();
        this.clearAll();
        log('[betterKeys] AnimationManager destroyed');
    }
});
