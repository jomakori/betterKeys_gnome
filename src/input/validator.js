/* src/input/validator.js - Input validation and sanitization for security */

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

/**
 * InputValidator validates input events for security, sanitizes text,
 * filters invalid key codes, implements rate limiting, and prevents
 * malicious patterns.
 */
export const InputValidator = GObject.registerClass(
class InputValidator extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;

        // Rate limiting state
        this._eventTimestamps = [];
        this._maxEventsPerSecond = 100; // reasonable limit
        this._windowSize = 1000; // ms

        // Key code whitelist (X11 key codes for typical keys)
        this._validKeyCodes = new Set();
        this._initValidKeyCodes();

        // Malicious pattern detection
        this._patternDetectors = [
            { pattern: /(\w)\1{10,}/, description: 'Repeated character flood' },
            { pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, description: 'Control characters' },
            { pattern: /<script|javascript:/i, description: 'Script injection attempt' },
            { pattern: /(\n|\r){20,}/, description: 'Excessive newlines' }
        ];

        // Input history for anomaly detection
        this._inputHistory = [];
        this._maxHistorySize = 1000;

        // Configuration
        this._config = {
            enableValidation: true,
            enableSanitization: true,
            enableRateLimiting: true,
            enablePatternDetection: true,
            maxInputLength: 1000,
            allowControlCharacters: false,
            allowUnicode: true
        };

        log('[betterKeys] InputValidator initialized');
    }

    /**
     * Initialize a set of valid key codes (X11/linux input event codes).
     * This is a simplified subset; real implementation would be more comprehensive.
     */
    _initValidKeyCodes() {
        // Alphanumeric keys
        for (let i = 0x20; i <= 0x7E; i++) {
            this._validKeyCodes.add(i);
        }

        // Function keys
        for (let i = 0xFFBE; i <= 0xFFC7; i++) { // F1‑F10
            this._validKeyCodes.add(i);
        }

        // Modifier keys
        const modifiers = [
            0xFFE1, // Shift_L
            0xFFE2, // Shift_R
            0xFFE3, // Control_L
            0xFFE4, // Control_R
            0xFFE5, // Caps_Lock
            0xFFE6, // Shift_Lock
            0xFFE7, // Meta_L
            0xFFE8, // Meta_R
            0xFFE9, // Alt_L
            0xFFEA, // Alt_R
            0xFFEB, // Super_L
            0xFFEC, // Super_R
            0xFFED, // Hyper_L
            0xFFEE, // Hyper_R
        ];
        modifiers.forEach(code => this._validKeyCodes.add(code));

        // Navigation keys
        const navKeys = [
            0xFF08, // BackSpace
            0xFF09, // Tab
            0xFF0D, // Return
            0xFF13, // Pause
            0xFF14, // Scroll_Lock
            0xFF15, // Sys_Req
            0xFF1B, // Escape
            0xFF50, // Home
            0xFF51, // Left
            0xFF52, // Up
            0xFF53, // Right
            0xFF54, // Down
            0xFF55, // Page_Up
            0xFF56, // Page_Down
            0xFF57, // End
            0xFF63, // Insert
            0xFFFF, // Delete
        ];
        navKeys.forEach(code => this._validKeyCodes.add(code));

        // Numpad keys
        for (let i = 0xFF80; i <= 0xFFB9; i++) {
            this._validKeyCodes.add(i);
        }
    }

    /**
     * Validate an input event.
     * @param {Object} event - Input event object.
     * @returns {boolean} True if event is valid.
     */
    validateEvent(event) {
        if (!this._config.enableValidation) {
            return true;
        }

        // Check event structure
        if (!event || typeof event !== 'object') {
            this._logSecurityIssue('Invalid event structure', event);
            return false;
        }

        // Rate limiting
        if (this._config.enableRateLimiting && !this._checkRateLimit()) {
            this._logSecurityIssue('Rate limit exceeded', event);
            return false;
        }

        // Validate key code if present
        if (event.keyCode !== undefined) {
            if (!this._validateKeyCode(event.keyCode)) {
                this._logSecurityIssue('Invalid key code', event);
                return false;
            }
        }

        // Validate coordinates if present
        if (event.x !== undefined && event.y !== undefined) {
            if (!this._validateCoordinates(event.x, event.y)) {
                this._logSecurityIssue('Invalid coordinates', event);
                return false;
            }
        }

        // Validate touch ID if present
        if (event.touchId !== undefined) {
            if (!this._validateTouchId(event.touchId)) {
                this._logSecurityIssue('Invalid touch ID', event);
                return false;
            }
        }

        // Record event timestamp for rate limiting
        this._recordEventTimestamp();

        return true;
    }

    /**
     * Validate a key code against whitelist.
     * @param {number} keyCode - Key code.
     * @returns {boolean} True if valid.
     */
    _validateKeyCode(keyCode) {
        if (typeof keyCode !== 'number') {
            return false;
        }

        // Allow any key code if whitelist is empty (for testing)
        if (this._validKeyCodes.size === 0) {
            return true;
        }

        return this._validKeyCodes.has(keyCode);
    }

    /**
     * Validate screen coordinates.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @returns {boolean} True if valid.
     */
    _validateCoordinates(x, y) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            return false;
        }

        // Coordinates should be within reasonable screen bounds
        // Assume screen size up to 8K (8192)
        return x >= -100 && x <= 8292 && y >= -100 && y <= 8292;
    }

    /**
     * Validate touch ID.
     * @param {number} touchId - Touch identifier.
     * @returns {boolean} True if valid.
     */
    _validateTouchId(touchId) {
        if (typeof touchId !== 'number') {
            return false;
        }

        // Touch IDs are typically small non‑negative integers
        return touchId >= 0 && touchId < 100;
    }

    /**
     * Check rate limiting.
     * @returns {boolean} True if within limit.
     */
    _checkRateLimit() {
        const now = GLib.get_monotonic_time() / 1000;
        const windowStart = now - this._windowSize;

        // Remove old timestamps
        this._eventTimestamps = this._eventTimestamps.filter(ts => ts >= windowStart);

        // Check if exceeding limit
        if (this._eventTimestamps.length >= this._maxEventsPerSecond) {
            return false;
        }

        return true;
    }

    /**
     * Record an event timestamp for rate limiting.
     */
    _recordEventTimestamp() {
        const now = GLib.get_monotonic_time() / 1000;
        this._eventTimestamps.push(now);

        // Keep only recent timestamps
        const windowStart = now - this._windowSize * 2;
        this._eventTimestamps = this._eventTimestamps.filter(ts => ts >= windowStart);
    }

    /**
     * Sanitize text input.
     * @param {string} text - Input text.
     * @returns {string} Sanitized text.
     */
    sanitizeText(text) {
        if (!this._config.enableSanitization) {
            return text;
        }

        if (typeof text !== 'string') {
            return '';
        }

        // Limit length
        if (text.length > this._config.maxInputLength) {
            text = text.substring(0, this._config.maxInputLength);
            this._logSecurityIssue('Input truncated due to length', { length: text.length });
        }

        // Remove control characters unless allowed
        if (!this._config.allowControlCharacters) {
            text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        }

        // Detect malicious patterns
        if (this._config.enablePatternDetection) {
            for (const detector of this._patternDetectors) {
                if (detector.pattern.test(text)) {
                    this._logSecurityIssue(`Malicious pattern detected: ${detector.description}`, { pattern: detector.pattern });
                    // Remove the matched pattern (simplified)
                    text = text.replace(detector.pattern, '');
                }
            }
        }

        // Record in history
        this._recordInput(text);

        return text;
    }

    /**
     * Validate and sanitize a key press.
     * @param {string} keyLabel - Key label.
     * @returns {string|null} Sanitized key label or null if invalid.
     */
    validateKeyPress(keyLabel) {
        if (typeof keyLabel !== 'string') {
            return null;
        }

        // Check for excessively long key labels (potential injection)
        if (keyLabel.length > 50) {
            this._logSecurityIssue('Key label too long', { keyLabel });
            return null;
        }

        // Check for dangerous characters
        if (/[\x00-\x1F<>\"\'\\]/.test(keyLabel)) {
            this._logSecurityIssue('Key label contains dangerous characters', { keyLabel });
            return null;
        }

        return keyLabel;
    }

    /**
     * Record input for anomaly detection.
     * @param {string} input - Input text.
     */
    _recordInput(input) {
        this._inputHistory.push({
            time: GLib.get_monotonic_time() / 1000,
            input: input.substring(0, 100) // store only first 100 chars
        });

        // Limit history size
        if (this._inputHistory.length > this._maxHistorySize) {
            this._inputHistory.shift();
        }
    }

    /**
     * Log a security issue.
     * @param {string} message - Issue description.
     * @param {Object} data - Additional data.
     */
    _logSecurityIssue(message, data = {}) {
        const logEntry = {
            time: new Date().toISOString(),
            message,
            data
        };

        // Emit signal for external handling
        this.emit('security-issue', logEntry);

        // Log to console (in production, this would go to a secure log)
        logError(`[betterKeys Security] ${message}: ${JSON.stringify(data)}`);
    }

    /**
     * Get current validation statistics.
     * @returns {Object} Statistics.
     */
    getStatistics() {
        return {
            totalEvents: this._eventTimestamps.length,
            eventsPerSecond: this._eventTimestamps.length / (this._windowSize / 1000),
            inputHistorySize: this._inputHistory.length,
            rateLimit: this._maxEventsPerSecond,
            config: { ...this._config }
        };
    }

    /**
     * Update validation configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        log('[betterKeys] InputValidator configuration updated');
    }

    /**
     * Reset rate limiting and history.
     */
    reset() {
        this._eventTimestamps = [];
        this._inputHistory = [];
        log('[betterKeys] InputValidator reset');
    }

    /**
     * Add a custom pattern detector.
     * @param {RegExp} pattern - Regular expression.
     * @param {string} description - Description of the pattern.
     */
    addPatternDetector(pattern, description) {
        this._patternDetectors.push({ pattern, description });
        log(`[betterKeys] Added pattern detector: ${description}`);
    }

    /**
     * Remove pattern detectors matching description.
     */
    removePatternDetector(description) {
        const initialLength = this._patternDetectors.length;
        this._patternDetectors = this._patternDetectors.filter(
            d => d.description !== description
        );
        const removed = initialLength - this._patternDetectors.length;
        log(`[betterKeys] Removed ${removed} pattern detector(s)`);
    }
});

// Add signals to the class
InputValidator.signals = {
    'security-issue': { param_types: [GObject.TYPE_POINTER] }
};
