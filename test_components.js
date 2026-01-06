#!/usr/bin/env gjs

imports.gi.versions.Gtk = '3.0';
const { GObject, Gio, GLib } = imports.gi;

// Mock extension imports
const Me = {
    imports: {
        src: {
            input: {
                'gesture-recognizer': require('./src/input/gesture-recognizer.js'),
                'text-engine': require('./src/input/text-engine.js')
            },
            prediction: {
                predictor: require('./src/prediction/predictor.js'),
                vocabulary: require('./src/prediction/vocabulary.js'),
                'ml-engine': require('./src/prediction/ml-engine.js')
            },
            keyboard: {
                'layout-adapter': require('./src/keyboard/layout-adapter.js'),
                'layout-manager': require('./src/keyboard/layout-manager.js')
            },
            ui: {
                'suggestion-bar': require('./src/ui/suggestion-bar.js')
            }
        }
    }
};

// Override global.log and global.logError
global.log = function(message) {
    print('LOG: ' + message);
};
global.logError = function(message) {
    print('ERROR: ' + message);
};

function testGestureRecognizer() {
    print('Testing GestureRecognizer...');
    const GestureRecognizer = Me.imports.src.input['gesture-recognizer'].GestureRecognizer;
    const recognizer = new GestureRecognizer(null);
    print('GestureRecognizer instantiated');
    // Test stroke methods
    recognizer.startStroke(100, 100, Date.now());
    recognizer.addStrokePoint(150, 150, Date.now());
    const result = recognizer.completeStroke(Date.now());
    print('Stroke completed, result:', JSON.stringify(result));
    return true;
}

function testVocabulary() {
    print('Testing Vocabulary...');
    const Vocabulary = Me.imports.src.prediction.vocabulary.Vocabulary;
    const vocab = new Vocabulary(null);
    print('Vocabulary instantiated, word count:', vocab.getStats().totalWords);
    vocab.addWord('test', { frequency: 10, language: 'en_US' });
    const suggestions = vocab.getWordsByPrefix('te', 5);
    print('Prefix suggestions for "te":', suggestions.length);
    return true;
}

function testPredictor() {
    print('Testing Predictor...');
    const Predictor = Me.imports.src.prediction.predictor.Predictor;
    const vocab = new (Me.imports.src.prediction.vocabulary.Vocabulary)(null);
    const predictor = new Predictor(vocab, null);
    print('Predictor instantiated');
    const suggestions = predictor.getSuggestions('th', 3);
    print('Suggestions for "th":', suggestions.length);
    return true;
}

function testMLEngine() {
    print('Testing MLEngine...');
    const MLEngine = Me.imports.src.prediction['ml-engine'].MLEngine;
    const vocab = new (Me.imports.src.prediction.vocabulary.Vocabulary)(null);
    const ml = new MLEngine(vocab, null);
    print('MLEngine instantiated');
    const predictions = ml.getPredictions('th', [], 2);
    print('ML predictions:', predictions.length);
    return true;
}

function testLayoutAdapter() {
    print('Testing LayoutAdapter...');
    const LayoutAdapter = Me.imports.src.keyboard['layout-adapter'].LayoutAdapter;
    const adapter = new LayoutAdapter(null);
    print('LayoutAdapter instantiated');
    return true;
}

function testSuggestionBar() {
    print('Testing SuggestionBar...');
    const SuggestionBar = Me.imports.src.ui['suggestion-bar'].SuggestionBar;
    const bar = new SuggestionBar(null, null);
    print('SuggestionBar instantiated');
    bar.updateSuggestions('te');
    print('SuggestionBar updated');
    return true;
}

function main() {
    print('=== Starting component tests ===');
    try {
        testGestureRecognizer();
        testVocabulary();
        testPredictor();
        testMLEngine();
        testLayoutAdapter();
        testSuggestionBar();
        print('=== All tests passed ===');
    } catch (e) {
        print('Test failed:', e);
        print(e.stack);
        return 1;
    }
    return 0;
}

main();
