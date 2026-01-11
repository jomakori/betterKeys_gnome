/* src/prediction/predictor.js - Predictive text engine with word suggestions */

const { GObject } = imports.gi;

/**
 * Predictor - Provides word predictions and suggestions based on context
 */
const Predictor = GObject.registerClass(
class Predictor extends GObject.Object {
    _init(vocabularyManager, settingsManager) {
        super._init();

        this._vocabulary = vocabularyManager;
        this._settings = settingsManager;

        // Configuration
        this._config = {
            suggestionCount: 5, // Number of suggestions to return
            minPrefixLength: 1, // Minimum characters to start suggesting
            maxSuggestionLength: 20, // Maximum word length to suggest
            enableAutocorrect: true,
            autocorrectThreshold: 0.8, // Confidence threshold for autocorrect
            enableContextAwareness: true,
            ngramOrder: 2, // Bigram (2), trigram (3), etc.
            cacheSize: 500
        };

        // Prediction cache
        this._predictionCache = new Map();
        this._contextHistory = []; // Previous words for context
        this._maxContextLength = 5;

        // N-gram models
        this._bigramModel = new Map(); // word1 -> { word2: frequency, ... }
        this._trigramModel = new Map(); // word1_word2 -> { word3: frequency, ... }

        // User vocabulary tracking
        this._userFrequency = new Map(); // word -> frequency count

        log('[betterKeys] Predictor initialized');
    }

    /**
     * Get word suggestions for a given prefix.
     * @param {string} prefix - Partial word to complete.
     * @param {number} limit - Maximum number of suggestions.
     * @returns {Array} Array of suggestion objects { word, confidence, type }.
     */
    getSuggestions(prefix, limit = null) {
        if (!prefix || prefix.length < this._config.minPrefixLength) {
            return [];
        }

        const count = limit || this._config.suggestionCount;
        const lowerPrefix = prefix.toLowerCase();

        // Check cache
        const cacheKey = `${lowerPrefix}_${count}`;
        if (this._predictionCache.has(cacheKey)) {
            return this._predictionCache.get(cacheKey);
        }

        // Get suggestions from vocabulary
        const suggestions = this._vocabulary.getWordsByPrefix(lowerPrefix, count * 2);

        // Score and rank suggestions
        const scored = suggestions.map(word => ({
            word,
            confidence: this._calculateConfidence(word, lowerPrefix),
            type: 'completion',
            frequency: this._vocabulary.getWordFrequency(word)
        }));

        // Sort by confidence and frequency
        scored.sort((a, b) => {
            const confDiff = b.confidence - a.confidence;
            if (Math.abs(confDiff) > 0.01) return confDiff;
            return b.frequency - a.frequency;
        });

        // Take top suggestions
        const result = scored.slice(0, count);

        // Cache result
        this._predictionCache.set(cacheKey, result);
        if (this._predictionCache.size > this._config.cacheSize) {
            const firstKey = this._predictionCache.keys().next().value;
            this._predictionCache.delete(firstKey);
        }

        return result;
    }

    /**
     * Get context-aware suggestions based on previous words.
     * @param {string} prefix - Partial word.
     * @param {number} limit - Maximum suggestions.
     * @returns {Array} Context-aware suggestions.
     */
    getContextSuggestions(prefix, limit = null) {
        if (!this._config.enableContextAwareness || this._contextHistory.length === 0) {
            return this.getSuggestions(prefix, limit);
        }

        const count = limit || this._config.suggestionCount;
        const lowerPrefix = prefix.toLowerCase();

        // Get suggestions based on n-gram models
        const contextKey = this._contextHistory.slice(-1)[0];
        const ngramSuggestions = this._bigramModel.get(contextKey) || {};

        // Get base suggestions
        const baseSuggestions = this._vocabulary.getWordsByPrefix(lowerPrefix, count * 2);

        // Combine and score
        const combined = new Map();
        baseSuggestions.forEach(word => {
            const baseScore = this._calculateConfidence(word, lowerPrefix);
            const ngramScore = (ngramSuggestions[word] || 0) / 100;
            const combinedScore = (baseScore * 0.7) + (ngramScore * 0.3);
            combined.set(word, {
                word,
                confidence: combinedScore,
                type: 'context',
                frequency: this._vocabulary.getWordFrequency(word)
            });
        });

        // Sort and return
        const result = Array.from(combined.values())
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, count);

        return result;
    }

    /**
     * Calculate confidence score for a word matching a prefix.
     * @param {string} word - Word to score.
     * @param {string} prefix - Prefix to match.
     * @returns {number} Confidence score 0-1.
     */
    _calculateConfidence(word, prefix) {
        if (!word.startsWith(prefix)) {
            return 0;
        }

        // Exact match gets highest score
        if (word === prefix) {
            return 1.0;
        }

        // Prefix match score based on length ratio
        const matchRatio = prefix.length / word.length;
        return Math.min(0.99, 0.5 + (matchRatio * 0.5));
    }

    /**
     * Detect and correct typos using Levenshtein distance.
     * @param {string} word - Word to check.
     * @param {number} maxDistance - Maximum edit distance.
     * @returns {Object} Correction result { corrected, confidence, original }.
     */
    detectTypo(word, maxDistance = 2) {
        if (!this._config.enableAutocorrect) {
            return { corrected: word, confidence: 1.0, original: word };
        }

        const lowerWord = word.toLowerCase();
        const candidates = this._vocabulary.getWordsWithinDistance(lowerWord, maxDistance);

        if (candidates.length === 0) {
            return { corrected: word, confidence: 1.0, original: word };
        }

        // Score candidates by frequency and distance
        const scored = candidates.map(candidate => ({
            word: candidate,
            distance: this._levenshteinDistance(lowerWord, candidate),
            frequency: this._vocabulary.getWordFrequency(candidate)
        }));

        scored.sort((a, b) => {
            const distDiff = a.distance - b.distance;
            if (distDiff !== 0) return distDiff;
            return b.frequency - a.frequency;
        });

        const best = scored[0];
        const confidence = 1.0 - (best.distance / lowerWord.length);

        if (confidence >= this._config.autocorrectThreshold) {
            return {
                corrected: best.word,
                confidence,
                original: word,
                distance: best.distance
            };
        }

        return { corrected: word, confidence: 1.0, original: word };
    }

    /**
     * Calculate Levenshtein distance between two strings.
     * @param {string} a - First string.
     * @param {string} b - Second string.
     * @returns {number} Edit distance.
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
     * Update context with a new word.
     * @param {string} word - Word to add to context.
     */
    updateContext(word) {
        const lowerWord = word.toLowerCase();

        // Update context history
        this._contextHistory.push(lowerWord);
        if (this._contextHistory.length > this._maxContextLength) {
            this._contextHistory.shift();
        }

        // Update n-gram models
        if (this._contextHistory.length >= 2) {
            const prevWord = this._contextHistory[this._contextHistory.length - 2];
            if (!this._bigramModel.has(prevWord)) {
                this._bigramModel.set(prevWord, {});
            }
            const bigrams = this._bigramModel.get(prevWord);
            bigrams[lowerWord] = (bigrams[lowerWord] || 0) + 1;
        }

        // Update user frequency
        this._userFrequency.set(lowerWord, (this._userFrequency.get(lowerWord) || 0) + 1);

        // Clear cache when context changes
        this._predictionCache.clear();
    }

    /**
     * Get word completion suggestions.
     * @param {string} prefix - Partial word.
     * @returns {Array} Completion suggestions.
     */
    getCompletions(prefix) {
        return this.getSuggestions(prefix);
    }

    /**
     * Get next word predictions.
     * @param {string} currentWord - Current word.
     * @param {number} limit - Maximum suggestions.
     * @returns {Array} Next word predictions.
     */
    getNextWordPredictions(currentWord, limit = null) {
        const count = limit || this._config.suggestionCount;
        const lowerWord = currentWord.toLowerCase();

        const nextWords = this._bigramModel.get(lowerWord) || {};
        const suggestions = Object.entries(nextWords)
            .map(([word, frequency]) => ({
                word,
                confidence: frequency / 100,
                type: 'next-word',
                frequency
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, count);

        return suggestions;
    }

    /**
     * Clear context history.
     */
    clearContext() {
        this._contextHistory = [];
        this._predictionCache.clear();
        log('[betterKeys] Prediction context cleared');
    }

    /**
     * Get prediction statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        return {
            cacheSize: this._predictionCache.size,
            contextLength: this._contextHistory.length,
            bigramCount: this._bigramModel.size,
            userVocabularySize: this._userFrequency.size,
            totalPredictions: this._predictionCache.size
        };
    }

    /**
     * Update configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        this._predictionCache.clear();
        log('[betterKeys] Predictor configuration updated');
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
Predictor.signals = {
    'suggestion-updated': { param_types: [GObject.TYPE_POINTER] },
    'context-changed': { param_types: [GObject.TYPE_STRING] }
};
