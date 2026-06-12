/* src/prediction/vocabulary.js - Vocabulary management for word lists and frequencies */

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

/**
 * Vocabulary - Manages word lists, frequencies, and multi-language support
 */
export const Vocabulary = GObject.registerClass(
class Vocabulary extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;

        // Configuration
        this._config = {
            defaultLanguage: 'en_US',
            minWordFrequency: 1,
            maxWordLength: 30,
            enableUserVocabulary: true,
            userVocabularyLimit: 1000,
            cacheSize: 1000
        };

        // Word storage
        this._words = new Map(); // word -> { frequency, language, category, metadata }
        this._languageIndex = new Map(); // language -> Set of words
        this._prefixIndex = new Map(); // prefix -> Set of words

        // User vocabulary
        this._userWords = new Map(); // word -> { frequency, addedDate, custom }
        this._userWordList = [];

        // Cache for frequent operations
        this._cache = new Map();
        this._cacheHits = 0;
        this._cacheMisses = 0;

        // Load default vocabulary
        this._loadDefaultVocabulary();

        log('[betterKeys] Vocabulary initialized');
    }

    /**
     * Load default vocabulary from data files.
     */
    _loadDefaultVocabulary() {
        try {
            // Load English vocabulary from extension data directory
            const enUsPath = GLib.build_filenamev([GLib.get_user_data_dir(), 'betterkeys', 'data/vocabularies/en_US.json']);
            const enUsFile = Gio.File.new_for_path(enUsPath);

            if (enUsFile.query_exists(null)) {
                this._loadVocabularyFile(enUsFile, 'en_US');
                log(`[betterKeys] Loaded vocabulary from JSON (${this._words.size} words)`);
            } else {
                // Try system dictionary as fallback
                this._loadSystemDict('en_US');
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load vocabulary: ${error}`);
            // Fallback to default built-in words
            this._createDefaultVocabulary();
        }
    }

    /**
     * Load words from system dictionary (e.g., /usr/share/dict/words).
     * @param {string} language - Language code.
     */
    _loadSystemDict(language) {
        try {
            const dictPaths = [
                '/usr/share/dict/american-english',
                '/usr/share/dict/words',
                '/usr/share/dict/linux.words'
            ];

            let dictFile = null;
            for (const path of dictPaths) {
                const file = Gio.File.new_for_path(path);
                if (file.query_exists(null)) {
                    dictFile = file;
                    break;
                }
            }

            if (!dictFile) {
                log('[betterKeys] No system dictionary found, using default vocabulary');
                this._createDefaultVocabulary();
                return;
            }

            const [success, contents] = dictFile.load_contents(null);
            if (!success) {
                throw new Error('Failed to read dictionary file');
            }

            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(contents);
            const lines = text.split('\n').filter(line => line.trim().length > 0);

            // Add words with decreasing frequency based on order (first words more common)
            const maxWords = 5000; // Limit to avoid memory issues
            const wordsToAdd = lines.slice(0, maxWords);

            wordsToAdd.forEach((word, index) => {
                // Simple frequency: higher for earlier words
                const frequency = Math.max(1, Math.floor(10000 * (1 - index / wordsToAdd.length)));
                this.addWord(word, {
                    frequency,
                    language,
                    category: 'system',
                    metadata: { source: 'system-dict' }
                });
            });

            log(`[betterKeys] Loaded ${wordsToAdd.length} words from system dictionary`);
        } catch (error) {
            logError(`[betterKeys] Failed to load system dictionary: ${error}`);
            this._createDefaultVocabulary();
        }
    }

    /**
     * Create default vocabulary with common English words.
     */
    _createDefaultVocabulary() {
        const defaultWords = [
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
            'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
            'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
            'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
            'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
            'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
            'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
            'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
            'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
        ];

        defaultWords.forEach((word, index) => {
            this.addWord(word, {
                frequency: 1000 - index,
                language: 'en_US',
                category: 'common'
            });
        });

        log(`[betterKeys] Created default vocabulary with ${defaultWords.length} words`);
    }

    /**
     * Load vocabulary from a JSON file.
     * @param {Gio.File} file - File to load.
     * @param {string} language - Language code.
     */
    _loadVocabularyFile(file, language) {
        try {
            const [success, contents] = file.load_contents(null);
            if (!success) {
                throw new Error('Failed to read file');
            }

            const decoder = new TextDecoder('utf-8');
            const jsonText = decoder.decode(contents);
            const data = JSON.parse(jsonText);

            if (data.words && Array.isArray(data.words)) {
                data.words.forEach(wordData => {
                    this.addWord(wordData.word, {
                        frequency: wordData.frequency || 1,
                        language: language,
                        category: wordData.category || 'general',
                        metadata: wordData.metadata || {}
                    });
                });
            }

            log(`[betterKeys] Loaded vocabulary from ${file.get_path()} (${language})`);
        } catch (error) {
            logError(`[betterKeys] Failed to load vocabulary file: ${error}`);
        }
    }

    /**
     * Add a word to the vocabulary.
     * @param {string} word - Word to add.
     * @param {Object} metadata - Word metadata.
     * @returns {boolean} True if word was added.
     */
    addWord(word, metadata = {}) {
        if (!word || word.length > this._config.maxWordLength) {
            return false;
        }

        const lowerWord = word.toLowerCase();
        const existing = this._words.get(lowerWord);

        if (existing) {
            // Update existing word
            existing.frequency = (existing.frequency || 0) + (metadata.frequency || 1);
            if (metadata.language) existing.language = metadata.language;
            if (metadata.category) existing.category = metadata.category;
            if (metadata.metadata) {
                existing.metadata = { ...existing.metadata, ...metadata.metadata };
            }
        } else {
            // Add new word
            this._words.set(lowerWord, {
                frequency: metadata.frequency || 1,
                language: metadata.language || this._config.defaultLanguage,
                category: metadata.category || 'general',
                metadata: metadata.metadata || {},
                addedDate: Date.now()
            });

            // Update language index
            const language = metadata.language || this._config.defaultLanguage;
            if (!this._languageIndex.has(language)) {
                this._languageIndex.set(language, new Set());
            }
            this._languageIndex.get(language).add(lowerWord);

            // Update prefix index
            for (let i = 1; i <= Math.min(3, lowerWord.length); i++) {
                const prefix = lowerWord.substring(0, i);
                if (!this._prefixIndex.has(prefix)) {
                    this._prefixIndex.set(prefix, new Set());
                }
                this._prefixIndex.get(prefix).add(lowerWord);
            }
        }

        // Clear relevant cache entries
        this._clearCacheForWord(lowerWord);

        return true;
    }

    /**
     * Add a word to user vocabulary.
     * @param {string} word - Word to add.
     * @param {Object} metadata - User metadata.
     * @returns {boolean} True if added.
     */
    addUserWord(word, metadata = {}) {
        if (!this._config.enableUserVocabulary) {
            return false;
        }

        const lowerWord = word.toLowerCase();
        const existing = this._userWords.get(lowerWord);

        if (existing) {
            existing.frequency = (existing.frequency || 0) + 1;
            existing.lastUsed = Date.now();
        } else {
            // Check limit
            if (this._userWords.size >= this._config.userVocabularyLimit) {
                // Remove least used word
                const leastUsed = this._userWordList
                    .sort((a, b) => a.lastUsed - b.lastUsed)[0];
                if (leastUsed) {
                    this._userWords.delete(leastUsed.word);
                    const index = this._userWordList.findIndex(w => w.word === leastUsed.word);
                    if (index !== -1) {
                        this._userWordList.splice(index, 1);
                    }
                }
            }

            this._userWords.set(lowerWord, {
                word: lowerWord,
                frequency: 1,
                addedDate: Date.now(),
                lastUsed: Date.now(),
                custom: metadata.custom || false,
                language: metadata.language || this._config.defaultLanguage
            });

            this._userWordList.push(this._userWords.get(lowerWord));
        }

        // Also add to main vocabulary if not already present
        if (!this._words.has(lowerWord)) {
            this.addWord(word, {
                frequency: 1,
                language: metadata.language || this._config.defaultLanguage,
                category: 'user',
                metadata: { userAdded: true }
            });
        }

        this.emit('user-vocabulary-changed', lowerWord);
        return true;
    }

    /**
     * Get words matching a prefix.
     * @param {string} prefix - Prefix to match.
     * @param {number} limit - Maximum number of words.
     * @returns {Array} Matching words.
     */
    getWordsByPrefix(prefix, limit = 10) {
        if (!prefix) return [];

        const lowerPrefix = prefix.toLowerCase();
        const cacheKey = `prefix_${lowerPrefix}_${limit}`;

        // Check cache
        if (this._cache.has(cacheKey)) {
            this._cacheHits++;
            return this._cache.get(cacheKey);
        }
        this._cacheMisses++;

        let words = [];

        // Check prefix index
        if (this._prefixIndex.has(lowerPrefix)) {
            words = Array.from(this._prefixIndex.get(lowerPrefix));
        } else {
            // Fallback to scanning all words
            for (const [word] of this._words) {
                if (word.startsWith(lowerPrefix)) {
                    words.push(word);
                }
                if (words.length >= limit * 2) break;
            }
        }

        // Sort by frequency
        words.sort((a, b) => {
            const freqA = this.getWordFrequency(a) || 0;
            const freqB = this.getWordFrequency(b) || 0;
            return freqB - freqA;
        });

        // Apply limit
        const result = words.slice(0, limit);

        // Cache result
        this._cache.set(cacheKey, result);
        if (this._cache.size > this._config.cacheSize) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }

        return result;
    }

    /**
     * Get word frequency.
     * @param {string} word - Word to check.
     * @returns {number} Frequency count.
     */
    getWordFrequency(word) {
        if (!word) return 0;

        const lowerWord = word.toLowerCase();
        const entry = this._words.get(lowerWord);
        return entry ? entry.frequency : 0;
    }

    /**
     * Get words within edit distance.
     * @param {string} word - Target word.
     * @param {number} maxDistance - Maximum edit distance.
     * @returns {Array} Words within distance.
     */
    getWordsWithinDistance(word, maxDistance = 2) {
        if (!word) return [];

        const lowerWord = word.toLowerCase();
        const cacheKey = `distance_${lowerWord}_${maxDistance}`;

        // Check cache
        if (this._cache.has(cacheKey)) {
            this._cacheHits++;
            return this._cache.get(cacheKey);
        }
        this._cacheMisses++;

        const candidates = [];

        for (const [candidate] of this._words) {
            const distance = this._levenshteinDistance(lowerWord, candidate);
            if (distance <= maxDistance) {
                candidates.push({
                    word: candidate,
                    distance,
                    frequency: this.getWordFrequency(candidate)
                });
            }
        }

        // Sort by distance, then frequency
        candidates.sort((a, b) => {
            const distDiff = a.distance - b.distance;
            if (distDiff !== 0) return distDiff;
            return b.frequency - a.frequency;
        });

        const result = candidates.map(c => c.word);

        // Cache result
        this._cache.set(cacheKey, result);
        if (this._cache.size > this._config.cacheSize) {
            const firstKey = this._cache.keys().next().value;
            this._cache.delete(firstKey);
        }

        return result;
    }

    /**
     * Calculate Levenshtein distance.
     */
    _levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Get top N words by frequency.
     * @param {number} limit - Number of words.
     * @returns {Array} Top words.
     */
    getTopWords(limit = 100) {
        const allWords = Array.from(this._words.entries());
        allWords.sort((a, b) => b[1].frequency - a[1].frequency);
        return allWords.slice(0, limit).map(entry => entry[0]);
    }

    /**
     * Remove a word from vocabulary.
     * @param {string} word - Word to remove.
     * @returns {boolean} True if removed.
     */
    removeWord(word) {
        if (!word) return false;

        const lowerWord = word.toLowerCase();
        const removed = this._words.delete(lowerWord);

        if (removed) {
            // Remove from language index
            for (const [language, wordSet] of this._languageIndex) {
                wordSet.delete(lowerWord);
                if (wordSet.size === 0) {
                    this._languageIndex.delete(language);
                }
            }

            // Remove from prefix index
            for (let i = 1; i <= Math.min(3, lowerWord.length); i++) {
                const prefix = lowerWord.substring(0, i);
                const prefixSet = this._prefixIndex.get(prefix);
                if (prefixSet) {
                    prefixSet.delete(lowerWord);
                    if (prefixSet.size === 0) {
                        this._prefixIndex.delete(prefix);
                    }
                }
            }

            this._clearCacheForWord(lowerWord);
        }

        return removed;
    }

    /**
     * Clear cache entries for a word.
     * @param {string} word - Word to clear cache for.
     */
    _clearCacheForWord(word) {
        const lowerWord = word.toLowerCase();
        const keysToDelete = [];

        for (const key of this._cache.keys()) {
            if (key.includes(lowerWord) || key.startsWith('prefix_')) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this._cache.delete(key));
    }

    /**
     * Get vocabulary statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        return {
            totalWords: this._words.size,
            languages: this._languageIndex.size,
            userWords: this._userWords.size,
            cacheSize: this._cache.size,
            cacheHits: this._cacheHits,
            cacheMisses: this._cacheMisses,
            cacheHitRate: this._cacheHits / (this._cacheHits + this._cacheMisses) || 0
        };
    }

    /**
     * Export vocabulary to JSON.
     * @param {string} language - Language to export.
     * @returns {string} JSON string.
     */
    exportVocabulary(language = null) {
        const words = [];

        for (const [word, data] of this._words) {
            if (!language || data.language === language) {
                words.push({
                    word,
                    frequency: data.frequency,
                    language: data.language,
                    category: data.category,
                    metadata: data.metadata
                });
            }
        }

        return JSON.stringify({
            version: 1,
            language: language || 'all',
            wordCount: words.length,
            words
        }, null, 2);
    }

    /**
     * Import vocabulary from JSON.
     * @param {string} json - JSON string.
     * @returns {boolean} True if imported successfully.
     */
    importVocabulary(json) {
        try {
            const data = JSON.parse(json);
            if (!data.words || !Array.isArray(data.words)) {
                throw new Error('Invalid vocabulary format');
            }

            data.words.forEach(wordData => {
                this.addWord(wordData.word, {
                    frequency: wordData.frequency || 1,
                    language: wordData.language || this._config.defaultLanguage,
                    category: wordData.category || 'imported',
                    metadata: wordData.metadata || {}
                });
            });

            log(`[betterKeys] Imported ${data.words.length} words`);
            return true;
        } catch (error) {
            logError(`[betterKeys] Failed to import vocabulary: ${error}`);
            return false;
        }
    }

    /**
     * Clear all vocabulary data.
     */
    clear() {
        this._words.clear();
        this._languageIndex.clear();
        this._prefixIndex.clear();
        this._userWords.clear();
        this._userWordList = [];
        this._cache.clear();
        this._cacheHits = 0;
        this._cacheMisses = 0;

        log('[betterKeys] Vocabulary cleared');
    }

    /**
     * Update configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        log('[betterKeys] Vocabulary configuration updated');
    }

    /**
     * Get current configuration.
     * @returns {Object} Configuration object.
     */
    getConfig() {
        return { ...this._config };
    }
});

// Add signals
Vocabulary.signals = {
    'user-vocabulary-changed': { param_types: [GObject.TYPE_STRING] },
    'vocabulary-updated': { param_types: [GObject.TYPE_POINTER] }
};
