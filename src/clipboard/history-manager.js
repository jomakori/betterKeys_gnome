/* src/clipboard/history-manager.js - Clipboard history tracking and management */

const { GObject, Gio, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ClipboardHistoryManager = GObject.registerClass(
class ClipboardHistoryManager extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._clipboard = Gtk.Clipboard.get_default(Gdk.Display.get_default());
        this._history = [];
        this._maxItems = 50;
        this._privacyMode = false;
        this._ttl = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        this._storageKey = 'clipboard-history';
        this._ignoreNextChange = false;
        this._changeHandlerId = 0;

        // Load saved history from GSettings
        this._loadHistory();

        // Start monitoring clipboard changes
        this._startMonitoring();

        log('[betterKeys] ClipboardHistoryManager initialized');
    }

    _startMonitoring() {
        // Connect to clipboard change signal
        this._changeHandlerId = this._clipboard.connect('owner-change', this._onClipboardChanged.bind(this));
    }

    _stopMonitoring() {
        if (this._changeHandlerId) {
            this._clipboard.disconnect(this._changeHandlerId);
            this._changeHandlerId = 0;
        }
    }

    _onClipboardChanged(clipboard, event) {
        if (this._ignoreNextChange) {
            this._ignoreNextChange = false;
            return;
        }

        // Get clipboard content
        const text = clipboard.wait_for_text();
        if (!text) {
            return; // Non-text content, ignore for now
        }

        // Check privacy mode
        if (this._privacyMode && this._isSensitive(text)) {
            log('[betterKeys] Skipping sensitive clipboard content');
            return;
        }

        // Check for duplicates
        if (this._isDuplicate(text)) {
            // Move to front (most recent)
            this._removeDuplicate(text);
        }

        // Create clipboard item
        const item = {
            id: GLib.uuid_string_random(),
            text: text,
            timestamp: Date.now(),
            source: 'clipboard',
            type: 'text',
            preview: this._truncateText(text, 100)
        };

        // Add to front of history
        this._history.unshift(item);

        // Trim to max items
        if (this._history.length > this._maxItems) {
            this._history = this._history.slice(0, this._maxItems);
        }

        // Save to GSettings
        this._saveHistory();

        // Emit signal
        this.emit('item-added', item);

        log(`[betterKeys] Clipboard item added: ${item.preview}`);
    }

    _isSensitive(text) {
        // Simple heuristic for sensitive data
        // Could be enhanced with regex patterns for passwords, credit cards, etc.
        const sensitivePatterns = [
            /password/i,
            /secret/i,
            /token/i,
            /api[_-]?key/i,
            /credit[_-]?card/i,
            /\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}/, // credit card number
            /ssh-rsa \w+/,
            /BEGIN (RSA|OPENSSH|PGP) PRIVATE KEY/
        ];

        return sensitivePatterns.some(pattern => pattern.test(text));
    }

    _isDuplicate(text) {
        return this._history.some(item => item.text === text);
    }

    _removeDuplicate(text) {
        const index = this._history.findIndex(item => item.text === text);
        if (index !== -1) {
            this._history.splice(index, 1);
        }
    }

    _truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    _loadHistory() {
        try {
            const serialized = this._settings._settings.get_string(this._storageKey);
            if (serialized && serialized.length > 0) {
                const parsed = JSON.parse(serialized);
                // Filter expired items
                const now = Date.now();
                this._history = parsed.filter(item => {
                    if (item.timestamp && (now - item.timestamp) > this._ttl) {
                        return false; // expired
                    }
                    return true;
                });
                log(`[betterKeys] Loaded ${this._history.length} clipboard history items`);
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load clipboard history: ${error}`);
            this._history = [];
        }
    }

    _saveHistory() {
        try {
            const serialized = JSON.stringify(this._history);
            this._settings._settings.set_string(this._storageKey, serialized);
        } catch (error) {
            logError(`[betterKeys] Failed to save clipboard history: ${error}`);
        }
    }

    /**
     * Get clipboard history items.
     * @param {number} limit - Maximum number of items to return.
     * @param {string} searchQuery - Optional search query to filter items.
     * @returns {Array} Array of clipboard items.
     */
    getHistory(limit = 0, searchQuery = '') {
        let items = this._history;

        // Apply search filter
        if (searchQuery && searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                item.text.toLowerCase().includes(query) ||
                item.preview.toLowerCase().includes(query)
            );
        }

        // Apply limit
        if (limit > 0 && items.length > limit) {
            items = items.slice(0, limit);
        }

        return items;
    }

    /**
     * Get a specific clipboard item by ID.
     * @param {string} id - Item ID.
     * @returns {Object|null} Clipboard item or null if not found.
     */
    getItem(id) {
        return this._history.find(item => item.id === id) || null;
    }

    /**
     * Add an item to clipboard history manually.
     * @param {string} text - Text content.
     * @param {string} source - Source identifier (optional).
     * @returns {Object} The created clipboard item.
     */
    addItem(text, source = 'manual') {
        const item = {
            id: GLib.uuid_string_random(),
            text: text,
            timestamp: Date.now(),
            source: source,
            type: 'text',
            preview: this._truncateText(text, 100)
        };

        this._history.unshift(item);
        if (this._history.length > this._maxItems) {
            this._history = this._history.slice(0, this._maxItems);
        }

        this._saveHistory();
        this.emit('item-added', item);

        return item;
    }

    /**
     * Remove an item from history.
     * @param {string} id - Item ID.
     * @returns {boolean} True if item was removed.
     */
    removeItem(id) {
        const index = this._history.findIndex(item => item.id === id);
        if (index !== -1) {
            this._history.splice(index, 1);
            this._saveHistory();
            this.emit('item-removed', id);
            return true;
        }
        return false;
    }

    /**
     * Clear all clipboard history.
     */
    clearHistory() {
        const count = this._history.length;
        this._history = [];
        this._saveHistory();
        this.emit('history-cleared', count);
        log(`[betterKeys] Cleared ${count} clipboard history items`);
    }

    /**
     * Copy an item to system clipboard.
     * @param {string} id - Item ID.
     * @returns {boolean} True if successful.
     */
    copyToClipboard(id) {
        const item = this.getItem(id);
        if (!item) {
            return false;
        }

        // Set clipboard content
        this._ignoreNextChange = true;
        this._clipboard.set_text(item.text, -1);

        // Move item to front (most recent)
        this._removeDuplicate(item.text);
        this._history.unshift(item);
        this._saveHistory();

        this.emit('item-copied', item);
        return true;
    }

    /**
     * Set maximum number of history items.
     * @param {number} maxItems - Maximum items (1-1000).
     */
    setMaxItems(maxItems) {
        const clamped = Math.max(1, Math.min(1000, maxItems));
        this._maxItems = clamped;

        // Trim history if needed
        if (this._history.length > this._maxItems) {
            this._history = this._history.slice(0, this._maxItems);
            this._saveHistory();
        }
    }

    /**
     * Enable or disable privacy mode.
     * @param {boolean} enabled - Whether privacy mode is enabled.
     */
    setPrivacyMode(enabled) {
        this._privacyMode = enabled;
    }

    /**
     * Set time-to-live for history items.
     * @param {number} ttlDays - TTL in days.
     */
    setTTL(ttlDays) {
        this._ttl = ttlDays * 24 * 60 * 60 * 1000;

        // Remove expired items
        const now = Date.now();
        const before = this._history.length;
        this._history = this._history.filter(item => {
            if (item.timestamp && (now - item.timestamp) > this._ttl) {
                return false;
            }
            return true;
        });

        if (this._history.length !== before) {
            this._saveHistory();
        }
    }

    /**
     * Get statistics about clipboard history.
     * @returns {Object} Statistics object.
     */
    getStats() {
        const now = Date.now();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const itemsToday = this._history.filter(item =>
            item.timestamp >= today.getTime()
        ).length;

        const totalChars = this._history.reduce((sum, item) =>
            sum + (item.text ? item.text.length : 0), 0
        );

        return {
            totalItems: this._history.length,
            itemsToday: itemsToday,
            maxItems: this._maxItems,
            privacyMode: this._privacyMode,
            ttlDays: this._ttl / (24 * 60 * 60 * 1000),
            totalCharacters: totalChars,
            avgLength: this._history.length > 0 ? totalChars / this._history.length : 0
        };
    }

    /**
     * Export clipboard history as JSON.
     * @returns {string} JSON string.
     */
    exportHistory() {
        return JSON.stringify(this._history, null, 2);
    }

    /**
     * Import clipboard history from JSON.
     * @param {string} json - JSON string.
     * @returns {boolean} True if import succeeded.
     */
    importHistory(json) {
        try {
            const imported = JSON.parse(json);
            if (!Array.isArray(imported)) {
                throw new Error('Imported data is not an array');
            }

            // Validate each item
            const validItems = imported.filter(item =>
                item && typeof item.text === 'string' && item.timestamp
            );

            // Merge with existing history (deduplicate by text)
            const existingTexts = new Set(this._history.map(item => item.text));
            const newItems = validItems.filter(item => !existingTexts.has(item.text));

            this._history = [...newItems, ...this._history];

            // Trim to max items
            if (this._history.length > this._maxItems) {
                this._history = this._history.slice(0, this._maxItems);
            }

            this._saveHistory();
            this.emit('history-imported', newItems.length);

            log(`[betterKeys] Imported ${newItems.length} clipboard history items`);
            return true;
        } catch (error) {
            logError(`[betterKeys] Failed to import clipboard history: ${error}`);
            return false;
        }
    }

    destroy() {
        this._stopMonitoring();
        super.destroy();
        log('[betterKeys] ClipboardHistoryManager destroyed');
    }
});

// Add signals to the class
ClipboardHistoryManager.signals = {
    'item-added': { param_types: [GObject.TYPE_OBJECT] },
    'item-removed': { param_types: [GObject.TYPE_STRING] },
    'item-copied': { param_types: [GObject.TYPE_OBJECT] },
    'history-cleared': { param_types: [GObject.TYPE_INT] },
    'history-imported': { param_types: [GObject.TYPE_INT] }
};
