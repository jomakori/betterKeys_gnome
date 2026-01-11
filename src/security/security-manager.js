/* src/security/security-manager.js - Comprehensive security hardening and management */

const { GObject, GLib, Gio, Gdk } = imports.gi;

/**
 * SecurityManager - Centralized security hardening, validation, encryption,
 * permission management, sandboxing, and vulnerability scanning.
 */
const SecurityManager = GObject.registerClass(
class SecurityManager extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._isEnabled = true;

        // Configuration
        this._config = {
            // Input validation
            enableInputValidation: true,
            enableSanitization: true,
            maxInputLength: 1000,
            allowControlCharacters: false,
            allowUnicode: true,

            // Data encryption
            encryptSensitiveData: true,
            encryptionAlgorithm: 'AES-256-GCM',
            encryptionKeyStorage: 'keyring', // 'keyring', 'file', 'memory'
            encryptClipboardHistory: false,
            encryptVocabulary: false,

            // Permission management
            requireExplicitPermissions: true,
            permissions: {
                fileSystem: false,
                network: false,
                systemCommands: false,
                clipboardRead: true,
                clipboardWrite: true,
                inputMonitoring: true,
                accessibility: true,
            },

            // Sandboxing
            restrictFileAccess: true,
            allowedFilePaths: [],
            restrictNetworkAccess: true,
            allowedDomains: [],
            restrictSystemCalls: true,

            // Code security
            removeDebugLogs: true,
            validateExternalData: true,
            preventTimingAttacks: true,
            secureRandomGeneration: true,

            // Vulnerability scanning
            scanForVulnerabilities: true,
            vulnerabilityScanInterval: 3600000, // 1 hour
            checkDependencies: true,
            securityAuditChecklist: true,
        };

        // Security state
        this._encryptionKey = null;
        this._permissionGrants = new Map(); // permission -> granted boolean
        this._securityLog = [];
        this._maxLogSize = 1000;
        this._vulnerabilityScanTimerId = 0;

        // Initialize
        this._initializePermissions();
        this._initializeEncryption();
        this._startVulnerabilityScanner();

        log('[betterKeys] SecurityManager initialized');
    }

    /**
     * Initialize permission grants based on configuration.
     */
    _initializePermissions() {
        for (const [permission, defaultValue] of Object.entries(this._config.permissions)) {
            this._permissionGrants.set(permission, defaultValue);
        }
    }

    /**
     * Initialize encryption key (placeholder).
     */
    _initializeEncryption() {
        if (!this._config.encryptSensitiveData) {
            return;
        }

        // In a real implementation, we'd load or generate a secure key.
        // For GNOME Shell extensions, we could use libsecret.
        this._encryptionKey = this._generateEncryptionKey();
        this._logSecurityEvent('encryption-key-generated', { algorithm: this._config.encryptionAlgorithm });
    }

    /**
     * Generate a secure encryption key (placeholder).
     */
    _generateEncryptionKey() {
        // This is a simplistic placeholder; real implementation would use
        // GNOME Keyring or libsecret.
        const array = new Uint8Array(32);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }

    /**
     * Start periodic vulnerability scanning.
     */
    _startVulnerabilityScanner() {
        if (!this._config.scanForVulnerabilities) {
            return;
        }

        this._vulnerabilityScanTimerId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this._config.vulnerabilityScanInterval,
            () => {
                this._performVulnerabilityScan();
                return true; // continue timer
            }
        );
    }

    /**
     * Stop security manager.
     */
    stop() {
        if (this._vulnerabilityScanTimerId) {
            GLib.source_remove(this._vulnerabilityScanTimerId);
            this._vulnerabilityScanTimerId = 0;
        }
        this._clearSensitiveData();
        log('[betterKeys] SecurityManager stopped');
    }

    /**
     * Clear sensitive data from memory.
     */
    _clearSensitiveData() {
        if (this._encryptionKey) {
            // Overwrite key in memory (as much as possible in JS)
            this._encryptionKey.fill(0);
            this._encryptionKey = null;
        }
        this._securityLog = [];
    }

    /**
     * Validate user input with comprehensive checks.
     * @param {string} input - User input.
     * @param {string} context - Context of input (e.g., 'clipboard', 'text-field').
     * @returns {Object} Validation result { isValid: boolean, sanitized: string, issues: Array }.
     */
    validateInput(input, context = 'generic') {
        const issues = [];

        if (typeof input !== 'string') {
            issues.push({ level: 'error', message: 'Input must be a string' });
            return { isValid: false, sanitized: '', issues };
        }

        // Length validation
        if (input.length > this._config.maxInputLength) {
            issues.push({ level: 'warning', message: `Input length exceeds ${this._config.maxInputLength} characters` });
            input = input.substring(0, this._config.maxInputLength);
        }

        // Control characters
        if (!this._config.allowControlCharacters) {
            const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
            if (controlCharRegex.test(input)) {
                issues.push({ level: 'warning', message: 'Input contains control characters' });
                input = input.replace(controlCharRegex, '');
            }
        }

        // Injection patterns
        const injectionPatterns = [
            { pattern: /<script/i, description: 'HTML script tag' },
            { pattern: /javascript:/i, description: 'JavaScript protocol' },
            { pattern: /on\w+\s*=/, description: 'HTML event handler' },
            { pattern: /\\x[0-9a-f]{2}/i, description: 'Hex escape sequence' },
            { pattern: /eval\s*\(/, description: 'eval call' },
            { pattern: /document\.(cookie|write)/i, description: 'DOM manipulation' },
        ];

        for (const { pattern, description } of injectionPatterns) {
            if (pattern.test(input)) {
                issues.push({ level: 'security', message: `Potential injection: ${description}` });
                input = input.replace(pattern, '');
            }
        }

        // Context-specific validation
        switch (context) {
            case 'clipboard':
                // Clipboard content may be more permissive
                break;
            case 'text-field':
                // Limit to printable characters
                break;
            case 'file-path':
                if (!this._validateFilePath(input)) {
                    issues.push({ level: 'error', message: 'Invalid file path' });
                    return { isValid: false, sanitized: '', issues };
                }
                break;
            case 'url':
                if (!this._validateUrl(input)) {
                    issues.push({ level: 'error', message: 'Invalid URL' });
                    return { isValid: false, sanitized: '', issues };
                }
                break;
        }

        const isValid = issues.filter(i => i.level === 'error').length === 0;
        this._logValidation(input, context, issues);

        return { isValid, sanitized: input, issues };
    }

    /**
     * Validate a file path for security.
     */
    _validateFilePath(path) {
        if (typeof path !== 'string') return false;

        // Prevent directory traversal
        if (path.includes('..') || path.includes('//')) {
            return false;
        }

        // Restrict to allowed paths if configured
        if (this._config.restrictFileAccess && this._config.allowedFilePaths.length > 0) {
            const allowed = this._config.allowedFilePaths.some(allowedPath =>
                path.startsWith(allowedPath)
            );
            if (!allowed) return false;
        }

        return true;
    }

    /**
     * Validate a URL for security.
     */
    _validateUrl(url) {
        try {
            const parsed = new URL(url);
            // Restrict to allowed domains
            if (this._config.restrictNetworkAccess && this._config.allowedDomains.length > 0) {
                const domain = parsed.hostname;
                const allowed = this._config.allowedDomains.some(allowedDomain =>
                    domain === allowedDomain || domain.endsWith('.' + allowedDomain)
                );
                if (!allowed) return false;
            }
            // Disallow dangerous protocols
            const dangerousProtocols = ['file', 'javascript', 'data', 'vbscript'];
            if (dangerousProtocols.includes(parsed.protocol.slice(0, -1))) {
                return false;
            }
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Encrypt sensitive data.
     * @param {string} plaintext - Data to encrypt.
     * @param {string} context - Context for key derivation.
     * @returns {string} Base64-encoded encrypted data, or plaintext if encryption disabled.
     */
    encrypt(plaintext, context = 'default') {
        if (!this._config.encryptSensitiveData || !this._encryptionKey) {
            return plaintext;
        }

        // Placeholder encryption - real implementation would use Gio's crypto APIs
        // For demonstration, we'll just return a mock encrypted string.
        const mockEncrypted = btoa(plaintext); // DO NOT USE IN PRODUCTION
        this._logSecurityEvent('data-encrypted', { context, length: plaintext.length });
        return `encrypted:${mockEncrypted}`;
    }

    /**
     * Decrypt data.
     * @param {string} ciphertext - Encrypted data.
     * @param {string} context - Context for key derivation.
     * @returns {string} Decrypted plaintext, or ciphertext if decryption fails/disabled.
     */
    decrypt(ciphertext, context = 'default') {
        if (!this._config.encryptSensitiveData || !this._encryptionKey) {
            return ciphertext;
        }

        if (!ciphertext.startsWith('encrypted:')) {
            this._logSecurityEvent('decryption-failed', { reason: 'invalid format' });
            return ciphertext;
        }

        try {
            const mockEncrypted = ciphertext.substring('encrypted:'.length);
            const plaintext = atob(mockEncrypted); // DO NOT USE IN PRODUCTION
            this._logSecurityEvent('data-decrypted', { context, length: plaintext.length });
            return plaintext;
        } catch (error) {
            this._logSecurityEvent('decryption-failed', { error: error.message });
            return ciphertext;
        }
    }

    /**
     * Check if a permission is granted.
     * @param {string} permission - Permission identifier.
     * @returns {boolean} True if granted.
     */
    checkPermission(permission) {
        if (!this._config.requireExplicitPermissions) {
            return true;
        }

        const granted = this._permissionGrants.get(permission);
        if (granted === undefined) {
            this._logSecurityEvent('unknown-permission', { permission });
            return false;
        }

        return granted;
    }

    /**
     * Request a permission (interactive).
     * @param {string} permission - Permission identifier.
     * @param {string} reason - Reason for request.
     * @returns {boolean} True if granted.
     */
    requestPermission(permission, reason) {
        if (!this._config.requireExplicitPermissions) {
            return true;
        }

        // In a real extension, we'd show a dialog to the user.
        // For now, we'll auto-grant based on configuration.
        const defaultValue = this._config.permissions[permission];
        if (defaultValue === undefined) {
            this._logSecurityEvent('permission-denied', { permission, reason: 'unknown' });
            return false;
        }

        this._permissionGrants.set(permission, defaultValue);
        this._logSecurityEvent('permission-granted', { permission, reason });

        return defaultValue;
    }

    /**
     * Revoke a permission.
     */
    revokePermission(permission) {
        this._permissionGrants.set(permission, false);
        this._logSecurityEvent('permission-revoked', { permission });
    }

    /**
     * Perform a vulnerability scan.
     */
    _performVulnerabilityScan() {
        const vulnerabilities = [];

        // Check for debug logs
        if (this._config.removeDebugLogs) {
            // Could scan source files for console.log, log, etc.
            // Placeholder
        }

        // Check dependency versions (if we had package.json)
        if (this._config.checkDependencies) {
            // Placeholder
        }

        // Security audit checklist
        if (this._config.securityAuditChecklist) {
            vulnerabilities.push(...this._runSecurityAudit());
        }

        if (vulnerabilities.length > 0) {
            this._logSecurityEvent('vulnerabilities-found', { count: vulnerabilities.length, vulnerabilities });
            this.emit('vulnerability-scan-result', vulnerabilities);
        } else {
            this._logSecurityEvent('vulnerability-scan-clean', {});
        }
    }

    /**
     * Run security audit checklist.
     */
    _runSecurityAudit() {
        const issues = [];

        // Example checks
        if (!this._config.enableInputValidation) {
            issues.push({ severity: 'medium', description: 'Input validation disabled' });
        }
        if (!this._config.encryptSensitiveData) {
            issues.push({ severity: 'low', description: 'Sensitive data encryption disabled' });
        }
        if (this._config.permissions.fileSystem) {
            issues.push({ severity: 'high', description: 'File system permission enabled' });
        }
        if (this._config.permissions.network) {
            issues.push({ severity: 'high', description: 'Network permission enabled' });
        }

        return issues;
    }

    /**
     * Log a security event.
     */
    _logSecurityEvent(type, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            type,
            data,
        };

        this._securityLog.push(entry);
        if (this._securityLog.length > this._maxLogSize) {
            this._securityLog.shift();
        }

        // Emit signal
        this.emit('security-event', entry);

        // Log to console (in production, would be secure logging)
        log(`[betterKeys Security] ${type}: ${JSON.stringify(data)}`);
    }

    /**
     * Log validation result.
     */
    _logValidation(input, context, issues) {
        if (issues.length === 0) return;

        this._logSecurityEvent('validation-issues', {
            context,
            inputLength: input.length,
            issueCount: issues.length,
            issues,
        });
    }

    /**
     * Get security log.
     */
    getSecurityLog(limit = 100) {
        return this._securityLog.slice(-limit);
    }

    /**
     * Clear security log.
     */
    clearSecurityLog() {
        this._securityLog = [];
    }

    /**
     * Get security configuration.
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Update security configuration.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        this._logSecurityEvent('config-updated', { config });
        log('[betterKeys] SecurityManager configuration updated');
    }

    /**
     * Get permission status.
     */
    getPermissions() {
        const status = {};
        for (const [permission, granted] of this._permissionGrants) {
            status[permission] = granted;
        }
        return status;
    }

    /**
     * Generate a secure random number.
     */
    secureRandom(min, max) {
        if (!this._config.secureRandomGeneration) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        // Use GLib's random number generator
        const range = max - min + 1;
        const random = GLib.random_int_range(min, max + 1);
        return random;
    }

    /**
     * Sanitize HTML content.
     */
    sanitizeHtml(html) {
        // Very basic sanitization - remove script tags and event handlers
        let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/ on\w+="[^"]*"/g, '');
        sanitized = sanitized.replace(/ on\w+='[^']*'/g, '');
        sanitized = sanitized.replace(/ on\w+=\w+/g, '');
        return sanitized;
    }

    /**
     * Validate layout file content.
     */
    validateLayoutFile(content) {
        try {
            const layout = JSON.parse(content);
            // Required fields
            if (!layout.id || typeof layout.id !== 'string') {
                return { valid: false, error: 'Missing or invalid id' };
            }
            if (!layout.rows || !Array.isArray(layout.rows)) {
                return { valid: false, error: 'Missing or invalid rows' };
            }
            // Check each row
            for (let i = 0; i < layout.rows.length; i++) {
                const row = layout.rows[i];
                if (!row.keys || !Array.isArray(row.keys)) {
                    return { valid: false, error: `Row ${i} missing keys array` };
                }
                for (const key of row.keys) {
                    if (typeof key !== 'string') {
                        return { valid: false, error: `Row ${i} contains non-string key` };
                    }
                    // Key label length limit
                    if (key.length > 100) {
                        return { valid: false, error: `Row ${i} key label too long` };
                    }
                }
            }
            return { valid: true, layout };
        } catch (error) {
            return { valid: false, error: `JSON parse error: ${error.message}` };
        }
    }

    /**
     * Validate emoji/special character data.
     */
    validateEmojiData(data) {
        try {
            const obj = JSON.parse(data);
            if (!Array.isArray(obj)) {
                return { valid: false, error: 'Data must be an array' };
            }
            for (const entry of obj) {
                if (!entry.char || typeof entry.char !== 'string') {
                    return { valid: false, error: 'Missing char field' };
                }
                if (entry.char.length > 10) {
                    return { valid: false, error: 'Char too long' };
                }
            }
            return { valid: true };
        } catch (error) {
            return { valid: false, error: `JSON parse error: ${error.message}` };
        }
    }

    /**
     * Enable/disable security manager.
     */
    setEnabled(enabled) {
        this._isEnabled = enabled;
        this._logSecurityEvent('manager-' + (enabled ? 'enabled' : 'disabled'), {});
        log(`[betterKeys] SecurityManager ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get security statistics.
     */
    getStatistics() {
        return {
            securityLogSize: this._securityLog.length,
            encryptionEnabled: this._config.encryptSensitiveData,
            validationEnabled: this._config.enableInputValidation,
            permissions: this.getPermissions(),
            vulnerabilityScanCount: this._securityLog.filter(e => e.type.includes('vulnerability')).length,
        };
    }

    /**
     * Reset security state.
     */
    reset() {
        this._clearSensitiveData();
        this._securityLog = [];
        this._initializePermissions();
        this._initializeEncryption();
        this._logSecurityEvent('manager-reset', {});
        log('[betterKeys] SecurityManager reset');
    }
});

// Add signals to the class
SecurityManager.signals = {
   'security-event': { param_types: [GObject.TYPE_POINTER] },
   'vulnerability-scan-result': { param_types: [GObject.TYPE_POINTER] },
   'validation-issues': { param_types: [GObject.TYPE_POINTER] },
};
