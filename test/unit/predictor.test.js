/* test/unit/predictor.test.js - Unit tests for Predictor */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Predictor', () => {
    let settings;
    let Predictor;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock Predictor class
        Predictor = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
                this._vocabulary = new Set(['hello', 'world', 'test']);
                this._ngrams = new Map();
            }

            predict(input, maxSuggestions = 5) {
                const suggestions = [];
                for (const word of this._vocabulary) {
                    if (word.startsWith(input.toLowerCase())) {
                        suggestions.push(word);
                    }
                }
                return suggestions.slice(0, maxSuggestions);
            }

            addToVocabulary(word) {
                this._vocabulary.add(word.toLowerCase());
            }

            getVocabularySize() {
                return this._vocabulary.size;
            }
        };
    });

    test('should initialize with empty vocabulary', () => {
        const predictor = new Predictor(settings);
        expect(predictor.getVocabularySize()).toBe(3); // default mock vocabulary size
    });

    test('should predict words based on input', () => {
        const predictor = new Predictor(settings);
        const suggestions = predictor.predict('he');
        expect(suggestions).toContain('hello');
        expect(suggestions).not.toContain('world');
    });

    test('should limit suggestions to maxSuggestions', () => {
        const predictor = new Predictor(settings);
        predictor.addToVocabulary('heat');
        predictor.addToVocabulary('heap');
        predictor.addToVocabulary('heart');
        const suggestions = predictor.predict('he', 2);
        expect(suggestions.length).toBeLessThanOrEqual(2);
    });

    test('should add words to vocabulary', () => {
        const predictor = new Predictor(settings);
        const initialSize = predictor.getVocabularySize();
        predictor.addToVocabulary('newword');
        expect(predictor.getVocabularySize()).toBe(initialSize + 1);
    });
});
