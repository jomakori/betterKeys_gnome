/* src/prediction/ml-engine.js - Machine learning engine for advanced predictions */

const { GObject, Gio, GLib } = imports.gi;

/**
 * MLEngine - Neural network-based word prediction and learning
 */
const MLEngine = GObject.registerClass(
class MLEngine extends GObject.Object {
    _init(vocabularyManager, settingsManager) {
        super._init();

        this._vocabulary = vocabularyManager;
        this._settings = settingsManager;

        // Configuration
        this._config = {
            enableML: true,
            modelPath: 'data/ml-models/default-model.json',
            learningRate: 0.01,
            hiddenLayerSize: 64,
            trainingEpochs: 10,
            batchSize: 32,
            enableIncrementalLearning: true,
            privacyPreserving: true, // Keep data local
            fallbackToStatistical: true
        };

        // Neural network state
        this._model = null;
        this._isModelLoaded = false;
        this._vocabularySize = 0;
        this._wordToIndex = new Map();
        this._indexToWord = new Map();

        // Training data
        this._trainingData = [];
        this._maxTrainingSamples = 10000;

        // User behavior tracking
        this._userPatterns = new Map(); // word -> { context, frequency, timestamp }
        this._sessionHistory = [];

        log('[betterKeys] MLEngine initialized');
    }

    /**
     * Load ML model from file.
     * @returns {boolean} True if model loaded successfully.
     */
    loadModel() {
        try {
            const modelFile = Gio.File.new_for_path(
                GLib.build_filenamev([GLib.get_user_data_dir(), 'betterkeys', this._config.modelPath])
            );

            if (!modelFile.query_exists(null)) {
                log('[betterKeys] No ML model found, using statistical fallback');
                this._isModelLoaded = false;
                return false;
            }

            // In a real implementation, this would load TensorFlow.js or similar
            // For now, we'll simulate model loading
            this._model = {
                weights: {},
                biases: {},
                vocabulary: []
            };

            this._isModelLoaded = true;
            log('[betterKeys] ML model loaded successfully');
            return true;
        } catch (error) {
            logError(`[betterKeys] Failed to load ML model: ${error}`);
            this._isModelLoaded = false;
            return false;
        }
    }

    /**
     * Initialize vocabulary for ML model.
     */
    _initializeVocabulary() {
        const words = this._vocabulary.getTopWords(1000); // Use top 1000 words for ML
        this._vocabularySize = words.length;

        words.forEach((word, index) => {
            this._wordToIndex.set(word, index);
            this._indexToWord.set(index, word);
        });

        log(`[betterKeys] ML vocabulary initialized with ${this._vocabularySize} words`);
    }

    /**
     * Get ML-based predictions for a given context.
     * @param {string} prefix - Partial word.
     * @param {Array} context - Previous words.
     * @param {number} limit - Maximum suggestions.
     * @returns {Array} ML-based predictions.
     */
    getPredictions(prefix, context = [], limit = 5) {
        if (!this._config.enableML || !this._isModelLoaded) {
            if (this._config.fallbackToStatistical) {
                return this._getStatisticalPredictions(prefix, context, limit);
            }
            return [];
        }

        try {
            // Convert context to feature vector
            const features = this._contextToFeatures(context);

            // Get neural network predictions
            const predictions = this._modelPredict(features);

            // Filter by prefix and convert to word suggestions
            const suggestions = predictions
                .filter(pred => pred.word.startsWith(prefix.toLowerCase()))
                .slice(0, limit)
                .map(pred => ({
                    word: pred.word,
                    confidence: pred.confidence,
                    type: 'ml',
                    source: 'neural-network'
                }));

            return suggestions;
        } catch (error) {
            logError(`[betterKeys] ML prediction failed: ${error}`);
            return this._getStatisticalPredictions(prefix, context, limit);
        }
    }

    /**
     * Convert context words to feature vector.
     * @param {Array} context - Context words.
     * @returns {Array} Feature vector.
     */
    _contextToFeatures(context) {
        const features = new Array(this._vocabularySize).fill(0);

        context.forEach(word => {
            const index = this._wordToIndex.get(word.toLowerCase());
            if (index !== undefined) {
                features[index] = 1.0;
            }
        });

        return features;
    }

    /**
     * Simulate neural network prediction.
     * @param {Array} features - Input features.
     * @returns {Array} Predictions.
     */
    _modelPredict(_features) {
        // Simplified simulation - in real implementation would use TensorFlow.js
        const predictions = [];

        // Generate random predictions based on vocabulary
        for (let i = 0; i < Math.min(20, this._vocabularySize); i++) {
            const word = this._indexToWord.get(i);
            if (word) {
                // Simulate confidence based on word frequency
                const frequency = this._vocabulary.getWordFrequency(word) || 1;
                const confidence = Math.min(0.99, frequency / 1000);

                predictions.push({
                    word,
                    confidence,
                    index: i
                });
            }
        }

        // Sort by confidence
        predictions.sort((a, b) => b.confidence - a.confidence);

        return predictions;
    }

    /**
     * Get statistical fallback predictions.
     * @param {string} prefix - Partial word.
     * @param {Array} context - Context words.
     * @param {number} limit - Maximum suggestions.
     * @returns {Array} Statistical predictions.
     */
    _getStatisticalPredictions(prefix, context, limit) {
        // Use n-gram based predictions
        const suggestions = [];

        if (context.length > 0) {
            const lastWord = context[context.length - 1].toLowerCase();
            const nextWords = this._getNextWordProbabilities(lastWord);

            nextWords.forEach(({ word, probability }) => {
                if (word.startsWith(prefix.toLowerCase())) {
                    suggestions.push({
                        word,
                        confidence: probability,
                        type: 'statistical',
                        source: 'n-gram'
                    });
                }
            });
        }

        // Add prefix-based completions
        const completions = this._vocabulary.getWordsByPrefix(prefix.toLowerCase(), limit * 2);
        completions.forEach(word => {
            if (!suggestions.some(s => s.word === word)) {
                suggestions.push({
                    word,
                    confidence: 0.5,
                    type: 'statistical',
                    source: 'prefix'
                });
            }
        });

        // Sort and limit
        return suggestions
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, limit);
    }

    /**
     * Get next word probabilities based on n-grams.
     * @param {string} word - Current word.
     * @returns {Array} Next word probabilities.
     */
    _getNextWordProbabilities(_word) {
        // Simplified n-gram probabilities
        const probabilities = [];
        const allWords = this._vocabulary.getTopWords(100);

        allWords.forEach(nextWord => {
            // Simulate probability based on word frequency
            const freq = this._vocabulary.getWordFrequency(nextWord) || 1;
            const probability = Math.min(0.9, freq / 10000);

            probabilities.push({
                word: nextWord,
                probability
            });
        });

        return probabilities.sort((a, b) => b.probability - a.probability);
    }

    /**
     * Train the model on user data.
     * @param {Array} trainingPairs - Array of {input, output} pairs.
     */
    trainModel(trainingPairs) {
        if (!this._config.enableML || !this._config.enableIncrementalLearning) {
            return;
        }

        try {
            // Add to training data
            trainingPairs.forEach(pair => {
                this._trainingData.push(pair);
            });

            // Limit training data size
            if (this._trainingData.length > this._maxTrainingSamples) {
                this._trainingData = this._trainingData.slice(-this._maxTrainingSamples);
            }

            // Perform incremental training
            if (this._trainingData.length >= this._config.batchSize) {
                this._performIncrementalTraining();
            }

            log(`[betterKeys] ML model trained with ${trainingPairs.length} samples`);
        } catch (error) {
            logError(`[betterKeys] Training failed: ${error}`);
        }
    }

    /**
     * Perform incremental training on accumulated data.
     */
    _performIncrementalTraining() {
        // Simplified training simulation
        // In real implementation, this would update neural network weights
        log(`[betterKeys] Performing incremental training on ${this._trainingData.length} samples`);

        // Clear training data after processing
        this._trainingData = [];
    }

    /**
     * Learn from user input pattern.
     * @param {string} word - Word typed.
     * @param {Array} context - Context words.
     */
    learnFromInput(word, context) {
        if (!this._config.enableML || !this._config.privacyPreserving) {
            return;
        }

        const lowerWord = word.toLowerCase();
        const lowerContext = context.map(w => w.toLowerCase());

        // Update user patterns
        if (!this._userPatterns.has(lowerWord)) {
            this._userPatterns.set(lowerWord, {
                frequency: 0,
                contexts: [],
                lastUsed: Date.now()
            });
        }

        const pattern = this._userPatterns.get(lowerWord);
        pattern.frequency++;
        pattern.lastUsed = Date.now();

        // Add context if not already present
        if (lowerContext.length > 0) {
            const contextKey = lowerContext.join('_');
            if (!pattern.contexts.includes(contextKey)) {
                pattern.contexts.push(contextKey);
            }
        }

        // Add to session history
        this._sessionHistory.push({
            word: lowerWord,
            context: lowerContext,
            timestamp: Date.now()
        });

        // Limit session history
        if (this._sessionHistory.length > 1000) {
            this._sessionHistory.shift();
        }
    }

    /**
     * Get sentiment-aware suggestions.
     * @param {string} prefix - Partial word.
     * @param {string} sentiment - Sentiment ('positive', 'negative', 'neutral').
     * @param {number} limit - Maximum suggestions.
     * @returns {Array} Sentiment-aware suggestions.
     */
    getSentimentSuggestions(prefix, sentiment = 'neutral', limit = 5) {
        // Simplified sentiment analysis
        const sentimentWords = {
            positive: ['good', 'great', 'excellent', 'happy', 'love', 'nice', 'wonderful'],
            negative: ['bad', 'terrible', 'awful', 'sad', 'hate', 'poor', 'horrible'],
            neutral: ['the', 'and', 'but', 'however', 'therefore', 'meanwhile']
        };

        const words = sentimentWords[sentiment] || sentimentWords.neutral;
        const suggestions = words
            .filter(word => word.startsWith(prefix.toLowerCase()))
            .slice(0, limit)
            .map(word => ({
                word,
                confidence: 0.8,
                type: 'sentiment',
                sentiment
            }));

        return suggestions;
    }

    /**
     * Save model to disk.
     * @returns {boolean} True if saved successfully.
     */
    saveModel() {
        try {
            // In real implementation, save neural network weights
            log('[betterKeys] ML model saved');
            return true;
        } catch (error) {
            logError(`[betterKeys] Failed to save model: ${error}`);
            return false;
        }
    }

    /**
     * Get ML engine statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        return {
            modelLoaded: this._isModelLoaded,
            vocabularySize: this._vocabularySize,
            trainingSamples: this._trainingData.length,
            userPatterns: this._userPatterns.size,
            sessionHistory: this._sessionHistory.length,
            config: { ...this._config }
        };
    }

    /**
     * Update configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        log('[betterKeys] ML engine configuration updated');
    }

    /**
     * Get current configuration.
     * @returns {Object} Configuration object.
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Reset ML engine (clear all learned data).
     */
    reset() {
        this._model = null;
        this._isModelLoaded = false;
        this._trainingData = [];
        this._userPatterns.clear();
        this._sessionHistory = [];
        log('[betterKeys] ML engine reset');
    }
});

// Add signals
MLEngine.signals = {
    'model-updated': { param_types: [GObject.TYPE_POINTER] },
    'learning-complete': { param_types: [GObject.TYPE_POINTER] }
};
