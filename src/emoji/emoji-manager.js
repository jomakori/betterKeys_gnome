/* src/emoji/emoji-manager.js - Emoji library management */

const { GObject, Gio, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var EmojiManager = GObject.registerClass(
class EmojiManager extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._emojiData = null;
        this._categories = [];
        this._emojiByCategory = new Map();
        this._emojiByUnicode = new Map();
        this._emojiByName = new Map();
        this._searchIndex = []; // { emoji, name, keywords }
        this._recentlyUsed = [];
        this._maxRecentlyUsed = 50;
        this._skinTone = 'default'; // 'default', 'light', 'medium-light', 'medium', 'medium-dark', 'dark'
        this._skinToneModifiers = {
            'default': '',
            'light': '🏻',
            'medium-light': '🏼',
            'medium': '🏽',
            'medium-dark': '🏾',
            'dark': '🏿'
        };

        // Load emoji data
        this._loadEmojiData();

        // Load recently used from GSettings
        this._loadRecentlyUsed();

        log('[betterKeys] EmojiManager initialized');
    }

    _loadEmojiData() {
        try {
            const emojiJsonPath = Me.dir.get_child('data').get_child('emoji').get_child('emoji.json').get_path();
            const file = Gio.File.new_for_path(emojiJsonPath);
            const [success, contents] = file.load_contents(null);

            if (success) {
                const json = imports.byteArray.toString(contents);
                this._emojiData = JSON.parse(json);
                this._buildIndex();
                log(`[betterKeys] Loaded ${this._emojiData.length} emojis`);
            } else {
                throw new Error('Failed to load emoji.json');
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load emoji data: ${error}`);
            // Fallback to minimal emoji set
            this._loadFallbackEmojiData();
        }
    }

    _loadFallbackEmojiData() {
        // Minimal fallback emoji set for basic functionality
        this._emojiData = [
            {
                'emoji': '😀',
                'name': 'grinning face',
                'category': 'smileys-emotion',
                'subcategory': 'face-smiling',
                'keywords': ['face', 'grin', 'happy', 'joy'],
                'skinToneSupport': false
            },
            {
                'emoji': '😂',
                'name': 'face with tears of joy',
                'category': 'smileys-emotion',
                'subcategory': 'face-smiling',
                'keywords': ['face', 'tears', 'joy', 'laugh'],
                'skinToneSupport': false
            },
            {
                'emoji': '👍',
                'name': 'thumbs up',
                'category': 'people-body',
                'subcategory': 'hand-fingers-closed',
                'keywords': ['thumbsup', 'ok', 'good', 'approve'],
                'skinToneSupport': true
            },
            {
                'emoji': '❤️',
                'name': 'red heart',
                'category': 'symbols',
                'subcategory': 'heart',
                'keywords': ['heart', 'love', 'red'],
                'skinToneSupport': false
            },
            {
                'emoji': '🔥',
                'name': 'fire',
                'category': 'travel-places',
                'subcategory': 'sky-weather',
                'keywords': ['fire', 'hot', 'flame'],
                'skinToneSupport': false
            }
        ];
        this._buildIndex();
        log('[betterKeys] Loaded fallback emoji data');
    }

    _buildIndex() {
        this._categories = [];
        this._emojiByCategory.clear();
        this._emojiByUnicode.clear();
        this._emojiByName.clear();
        this._searchIndex = [];

        // Process each emoji
        this._emojiData.forEach(emoji => {
            // Add to category map
            if (!this._emojiByCategory.has(emoji.category)) {
                this._emojiByCategory.set(emoji.category, []);
                this._categories.push(emoji.category);
            }
            this._emojiByCategory.get(emoji.category).push(emoji);

            // Add to unicode map
            this._emojiByUnicode.set(emoji.emoji, emoji);

            // Add to name map (lowercase)
            const nameKey = emoji.name.toLowerCase();
            this._emojiByName.set(nameKey, emoji);

            // Build search index
            this._searchIndex.push({
                emoji: emoji.emoji,
                name: emoji.name,
                keywords: emoji.keywords || [],
                category: emoji.category
            });
        });

        // Sort categories
        this._categories.sort();

        // Sort emojis within each category by name
        this._emojiByCategory.forEach(emojis => {
            emojis.sort((a, b) => a.name.localeCompare(b.name));
        });

        log(`[betterKeys] Built index for ${this._emojiData.length} emojis across ${this._categories.length} categories`);
    }

    _loadRecentlyUsed() {
        try {
            const serialized = this._settings._settings.get_string('emoji-recently-used');
            if (serialized && serialized.length > 0) {
                this._recentlyUsed = JSON.parse(serialized);
                log(`[betterKeys] Loaded ${this._recentlyUsed.length} recently used emojis`);
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load recently used emojis: ${error}`);
            this._recentlyUsed = [];
        }
    }

    _saveRecentlyUsed() {
        try {
            const serialized = JSON.stringify(this._recentlyUsed);
            this._settings._settings.set_string('emoji-recently-used', serialized);
        } catch (error) {
            logError(`[betterKeys] Failed to save recently used emojis: ${error}`);
        }
    }

    /**
     * Get all emoji categories.
     * @returns {Array} Array of category names.
     */
    getCategories() {
        return [...this._categories];
    }

    /**
     * Get emojis for a specific category.
     * @param {string} category - Category name.
     * @returns {Array} Array of emoji objects.
     */
    getEmojisByCategory(category) {
        return this._emojiByCategory.get(category) || [];
    }

    /**
     * Get emoji by Unicode character.
     * @param {string} unicode - Emoji Unicode character.
     * @returns {Object|null} Emoji object or null.
     */
    getEmojiByUnicode(unicode) {
        return this._emojiByUnicode.get(unicode) || null;
    }

    /**
     * Get emoji by name (case-insensitive).
     * @param {string} name - Emoji name.
     * @returns {Object|null} Emoji object or null.
     */
    getEmojiByName(name) {
        return this._emojiByName.get(name.toLowerCase()) || null;
    }

    /**
     * Search emojis by query.
     * @param {string} query - Search query.
     * @param {number} limit - Maximum number of results.
     * @returns {Array} Array of matching emoji objects.
     */
    searchEmojis(query, limit = 50) {
        if (!query || query.trim() === '') {
            return [];
        }

        const normalizedQuery = query.toLowerCase().trim();
        const results = [];

        // Score each emoji based on match quality
        this._searchIndex.forEach(item => {
            let score = 0;

            // Exact name match
            if (item.name.toLowerCase() === normalizedQuery) {
                score += 100;
            }

            // Name contains query
            if (item.name.toLowerCase().includes(normalizedQuery)) {
                score += 10;
            }

            // Keyword matches
            const keywordMatches = item.keywords.filter(keyword =>
                keyword.toLowerCase().includes(normalizedQuery)
            ).length;
            score += keywordMatches * 5;

            // Emoji character matches (rare)
            if (item.emoji.includes(normalizedQuery)) {
                score += 1;
            }

            if (score > 0) {
                results.push({
                    emoji: this.getEmojiByUnicode(item.emoji),
                    score: score
                });
            }
        });

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Apply limit and return only emoji objects
        return results.slice(0, limit).map(result => result.emoji);
    }

    /**
     * Get recently used emojis.
     * @param {number} limit - Maximum number of recent emojis.
     * @returns {Array} Array of emoji objects.
     */
    getRecentlyUsed(limit = 20) {
        // Map Unicode strings back to emoji objects
        const recentEmojis = [];
        for (const unicode of this._recentlyUsed) {
            const emoji = this.getEmojiByUnicode(unicode);
            if (emoji) {
                recentEmojis.push(emoji);
                if (recentEmojis.length >= limit) {
                    break;
                }
            }
        }
        return recentEmojis;
    }

    /**
     * Record an emoji as recently used.
     * @param {string} emojiUnicode - Emoji Unicode character.
     */
    recordUsage(emojiUnicode) {
        // Remove if already in list
        this._recentlyUsed = this._recentlyUsed.filter(e => e !== emojiUnicode);

        // Add to front
        this._recentlyUsed.unshift(emojiUnicode);

        // Trim to max size
        if (this._recentlyUsed.length > this._maxRecentlyUsed) {
            this._recentlyUsed = this._recentlyUsed.slice(0, this._maxRecentlyUsed);
        }

        // Save to GSettings
        this._saveRecentlyUsed();

        this.emit('recently-used-updated', emojiUnicode);
    }

    /**
     * Clear recently used emojis.
     */
    clearRecentlyUsed() {
        this._recentlyUsed = [];
        this._saveRecentlyUsed();
        this.emit('recently-used-cleared');
    }

    /**
     * Get emoji with applied skin tone.
     * @param {string} emojiUnicode - Base emoji Unicode.
     * @param {string} skinTone - Skin tone preference.
     * @returns {string} Emoji with skin tone modifier.
     */
    getEmojiWithSkinTone(emojiUnicode, skinTone = null) {
        const tone = skinTone || this._skinTone;
        const modifier = this._skinToneModifiers[tone];

        if (!modifier || modifier === '') {
            return emojiUnicode;
        }

        const emoji = this.getEmojiByUnicode(emojiUnicode);
        if (!emoji || !emoji.skinToneSupport) {
            return emojiUnicode;
        }

        // Apply skin tone modifier (append modifier to emoji)
        // Note: This is simplified; real implementation would need to handle
        // zero-width joiner sequences and skin tone placement correctly.
        return emojiUnicode + modifier;
    }

    /**
     * Set preferred skin tone.
     * @param {string} skinTone - Skin tone identifier.
     */
    setSkinTone(skinTone) {
        if (this._skinToneModifiers.hasOwnProperty(skinTone)) {
            this._skinTone = skinTone;
            this.emit('skin-tone-changed', skinTone);
        } else {
            logError(`[betterKeys] Invalid skin tone: ${skinTone}`);
        }
    }

    /**
     * Get current skin tone.
     * @returns {string} Skin tone identifier.
     */
    getSkinTone() {
        return this._skinTone;
    }

    /**
     * Get all available skin tones.
     * @returns {Array} Array of skin tone identifiers.
     */
    getAvailableSkinTones() {
        return Object.keys(this._skinToneModifiers);
    }

    /**
     * Get emoji statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        const categoryCounts = {};
        this._emojiByCategory.forEach((emojis, category) => {
            categoryCounts[category] = emojis.length;
        });

        return {
            totalEmojis: this._emojiData.length,
            categories: this._categories.length,
            categoryCounts: categoryCounts,
            recentlyUsedCount: this._recentlyUsed.length,
            skinTone: this._skinTone,
            searchIndexSize: this._searchIndex.length
        };
    }

    /**
     * Get emoji frequency ranking (most used).
     * @param {number} limit - Number of top emojis to return.
     * @returns {Array} Array of { emoji, count } objects.
     */
    getFrequencyRanking(limit = 10) {
        // Simple implementation: count occurrences in recently used
        const frequency = new Map();
        this._recentlyUsed.forEach(unicode => {
            frequency.set(unicode, (frequency.get(unicode) || 0) + 1);
        });

        // Convert to array and sort
        const ranking = Array.from(frequency.entries())
            .map(([unicode, count]) => ({
                emoji: this.getEmojiByUnicode(unicode),
                count: count
            }))
            .filter(item => item.emoji)
            .sort((a, b) => b.count - a.count);

        return ranking.slice(0, limit);
    }

    /**
     * Export emoji data as JSON.
     * @returns {string} JSON string.
     */
    exportEmojiData() {
        return JSON.stringify(this._emojiData, null, 2);
    }

    /**
     * Import custom emoji data.
     * @param {string} json - JSON string containing emoji data.
     * @returns {boolean} True if import succeeded.
     */
    importEmojiData(json) {
        try {
            const imported = JSON.parse(json);
            if (!Array.isArray(imported)) {
                throw new Error('Imported data is not an array');
            }

            // Validate each emoji
            const validEmojis = imported.filter(emoji =>
                emoji && emoji.emoji && emoji.name && emoji.category
            );

            // Merge with existing data (deduplicate by Unicode)
            const existingUnicodes = new Set(this._emojiData.map(e => e.emoji));
            const newEmojis = validEmojis.filter(emoji => !existingUnicodes.has(emoji.emoji));

            this._emojiData = [...this._emojiData, ...newEmojis];
            this._buildIndex();

            this.emit('emoji-data-imported', newEmojis.length);
            log(`[betterKeys] Imported ${newEmojis.length} new emojis`);
            return true;
        } catch (error) {
            logError(`[betterKeys] Failed to import emoji data: ${error}`);
            return false;
        }
    }

    /**
     * Get emoji version support information.
     * @returns {Object} Version info.
     */
    getVersionInfo() {
        // This would normally be extracted from emoji data
        return {
            unicodeVersion: '14.0',
            emojiVersion: '14.0',
            dataSource: 'emoji.json',
            lastUpdated: '2025-01-01'
        };
    }

    destroy() {
        this._emojiData = null;
        this._categories = [];
        this._emojiByCategory.clear();
        this._emojiByUnicode.clear();
        this._emojiByName.clear();
        this._searchIndex = [];
        this._recentlyUsed = [];

        super.destroy();
        log('[betterKeys] EmojiManager destroyed');
    }
});

// Add signals to the class
EmojiManager.signals = {
    'recently-used-updated': { param_types: [GObject.TYPE_STRING] },
    'recently-used-cleared': { param_types: [] },
    'skin-tone-changed': { param_types: [GObject.TYPE_STRING] },
    'emoji-data-imported': { param_types: [GObject.TYPE_INT] }
};
