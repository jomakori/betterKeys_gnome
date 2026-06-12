/* src/input/text-engine.js - Text input engine for character insertion, editing, clipboard, undo/redo */

import GObject from 'gi://GObject';
import { Predictor } from '../prediction/predictor.js';
import { Vocabulary } from '../prediction/vocabulary.js';
import { MLEngine } from '../prediction/ml-engine.js';

/**
 * TextEngine handles text input operations including insertion, deletion,
 * selection, clipboard integration, and undo/redo management.
 */
export const TextEngine = GObject.registerClass(
class TextEngine extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._ibus = null;
        this._clipboard = null;

        // Undo/redo stacks
        this._undoStack = [];
        this._redoStack = [];
        this._maxUndoSteps = 50;

        // Selection state
        this._hasSelection = false;
        this._selectionStart = 0;
        this._selectionEnd = 0;
        this._cursorPosition = 0;

        // Text buffer (for simulation, not actual text)
        this._textBuffer = '';

        // Prediction components
        this._predictor = null;
        this._vocabulary = null;
        this._mlEngine = null;
        this._suggestionBar = null;
        this._predictionEnabled = true;
        this._autocorrectEnabled = true;
        this._lastWordStart = -1;
        this._currentWord = '';

        // Initialize IBus connection
        this._initIBus();

        // Initialize clipboard
        this._initClipboard();

        // Initialize prediction components
        this._initPrediction();

        log('[betterKeys] TextEngine initialized with prediction');
    }

    /**
     * Initialize IBus connection for text input.
     */
    _initIBus() {
        try {
            // Attempt to create IBus bus
            this._ibus = IBus.Bus.new();
            if (this._ibus) {
                this._ibus.connect('connected', () => {
                    log('[betterKeys] IBus connected');
                });
                this._ibus.connect('disconnected', () => {
                    log('[betterKeys] IBus disconnected');
                });
            } else {
                log('[betterKeys] IBus not available, using simulated input');
            }
        } catch (error) {
            logError(`[betterKeys] Failed to initialize IBus: ${error}`);
            this._ibus = null;
        }
    }

    /**
     * Initialize clipboard access.
     */
    _initClipboard() {
        try {
            this._clipboard = Gtk.Clipboard.get_default(Gdk.Display.get_default());
        } catch (error) {
            logError(`[betterKeys] Failed to initialize clipboard: ${error}`);
            this._clipboard = null;
        }
    }

    /**
     * Initialize prediction components.
     */
    _initPrediction() {
        try {
            // Load vocabulary
            this._vocabulary = new Vocabulary.VocabularyManager();
            this._vocabulary.loadDefault();

            // Initialize predictor
            this._predictor = new Predictor.Predictor(this._vocabulary);

            // Initialize ML engine (optional)
            try {
                this._mlEngine = new MLEngine.MLEngine();
                this._mlEngine.loadDefaultModel();
            } catch (error) {
                log(`[betterKeys] ML engine not available: ${error}`);
                this._mlEngine = null;
            }

            log('[betterKeys] Prediction components initialized');
        } catch (error) {
            logError(`[betterKeys] Failed to initialize prediction: ${error}`);
            this._predictionEnabled = false;
        }
    }

    /**
     * Set suggestion bar for displaying predictions.
     * @param {SuggestionBar} suggestionBar - The suggestion bar UI component.
     */
    setSuggestionBar(suggestionBar) {
        this._suggestionBar = suggestionBar;
        if (this._suggestionBar) {
            this._suggestionBar.connect('suggestion-selected', (bar, suggestion) => {
                this.applySuggestion(suggestion);
            });
        }
    }

    /**
     * Enable or disable prediction features.
     * @param {boolean} enabled - Whether prediction is enabled.
     */
    setPredictionEnabled(enabled) {
        this._predictionEnabled = enabled;
        if (!enabled && this._suggestionBar) {
            this._suggestionBar.clearSuggestions();
        }
    }

    /**
     * Enable or disable autocorrect.
     * @param {boolean} enabled - Whether autocorrect is enabled.
     */
    setAutocorrectEnabled(enabled) {
        this._autocorrectEnabled = enabled;
    }

    /**
     * Update current word based on cursor position.
     */
    _updateCurrentWord() {
        const text = this._textBuffer;
        const pos = this._cursorPosition;

        // Find start of current word
        let start = pos - 1;
        while (start >= 0 && !this._isWordSeparator(text.charAt(start))) {
            start--;
        }
        start++;

        // Find end of current word
        let end = pos;
        while (end < text.length && !this._isWordSeparator(text.charAt(end))) {
            end++;
        }

        this._lastWordStart = start;
        this._currentWord = text.substring(start, end);

        return this._currentWord;
    }

    /**
     * Check if character is a word separator.
     * @private
     */
    _isWordSeparator(char) {
        return char === ' ' || char === '\n' || char === '\t' || char === '.' ||
               char === ',' || char === '!' || char === '?' || char === ';' ||
               char === ':' || char === '(' || char === ')' || char === '\'' ||
               char === '"' || char === '';
    }

    /**
     * Get suggestions for current word/context.
     * @returns {Array} Array of suggestion objects.
     */
    getSuggestions() {
        if (!this._predictionEnabled || !this._predictor) {
            return [];
        }

        const currentWord = this._updateCurrentWord();
        const context = this._getContextWords();

        // Get predictions from statistical model
        let suggestions = this._predictor.predict(currentWord, context, 5);

        // If ML engine is available, get ML predictions and merge
        if (this._mlEngine) {
            const mlSuggestions = this._mlEngine.predict(currentWord, context, 3);
            suggestions = this._mergeSuggestions(suggestions, mlSuggestions);
        }

        // Apply autocorrect if enabled and word seems misspelled
        if (this._autocorrectEnabled && currentWord.length > 0) {
            const correction = this._predictor.autocorrect(currentWord);
            if (correction && correction !== currentWord) {
                // Add correction as first suggestion
                suggestions.unshift({
                    text: correction,
                    type: 'autocorrect',
                    confidence: 0.9
                });
            }
        }

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }

    /**
     * Get context words (previous words in sentence).
     * @private
     */
    _getContextWords() {
        const text = this._textBuffer;
        const pos = this._lastWordStart;

        if (pos <= 0) return [];

        // Extract last 3 words before current word
        const beforeText = text.substring(0, pos);
        const words = beforeText.split(/[\s\n\t.,!?;:()"']+/).filter(w => w.length > 0);
        return words.slice(-3);
    }

    /**
     * Merge suggestions from multiple sources.
     * @private
     */
    _mergeSuggestions(statSuggestions, mlSuggestions) {
        const merged = [...statSuggestions];
        const seen = new Set(statSuggestions.map(s => s.text));

        for (const mlSuggestion of mlSuggestions) {
            if (!seen.has(mlSuggestion.text)) {
                merged.push(mlSuggestion);
                seen.add(mlSuggestion.text);
            }
        }

        // Sort by confidence
        merged.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        return merged;
    }

    /**
     * Update suggestions in the suggestion bar.
     */
    updateSuggestions() {
        if (!this._suggestionBar || !this._predictionEnabled) {
            return;
        }

        const suggestions = this.getSuggestions();
        this._suggestionBar.setSuggestions(suggestions);
    }

    /**
     * Apply a suggestion (replace current word with suggestion).
     * @param {Object} suggestion - Suggestion object with text property.
     */
    applySuggestion(suggestion) {
        if (!suggestion || !suggestion.text || this._lastWordStart < 0) {
            return;
        }

        const currentWord = this._currentWord;
        const newWord = suggestion.text;

        if (currentWord === newWord) {
            return; // No change needed
        }

        // Record undo state before replacement
        this._recordUndoState();

        // Calculate end position of current word
        const endPos = this._lastWordStart + currentWord.length;

        // Replace the word in buffer
        this._textBuffer = this._textBuffer.substring(0, this._lastWordStart) +
                          newWord +
                          this._textBuffer.substring(endPos);

        // Update cursor position
        const lengthDiff = newWord.length - currentWord.length;
        this._cursorPosition = endPos + lengthDiff;

        // Send the replacement via IBus
        // First delete the old word, then insert new word
        for (let i = 0; i < currentWord.length; i++) {
            this._sendBackspace();
        }
        this._sendKeySequence(newWord);

        // Update vocabulary with user selection
        if (this._vocabulary && suggestion.type !== 'autocorrect') {
            this._vocabulary.addUserWord(newWord);
        }

        // Clear suggestions
        if (this._suggestionBar) {
            this._suggestionBar.clearSuggestions();
        }

        this.emit('suggestion-applied', { oldWord: currentWord, newWord: suggestion.text });
        log(`[betterKeys] Applied suggestion: "${currentWord}" -> "${newWord}"`);
    }

    /**
     * Handle space insertion (triggers word completion and updates predictions).
     */
    insertSpace() {
        // Before inserting space, check if we should auto-complete
        const currentWord = this._updateCurrentWord();
        if (currentWord.length > 0 && this._autocorrectEnabled && this._predictor) {
            const correction = this._predictor.autocorrect(currentWord);
            if (correction && correction !== currentWord) {
                // Apply autocorrect before inserting space
                this.applySuggestion({ text: correction, type: 'autocorrect' });
            }
        }

        // Insert space
        this.insertText(' ');

        // Update predictions for next word
        this.updateSuggestions();
    }

    /**
     * Insert text at current cursor position.
     * @param {string} text - Text to insert.
     */
    insertText(text) {
        if (!text || text.length === 0) {
            return;
        }

        // Record undo state before insertion
        this._recordUndoState();

        // If there's a selection, replace it
        if (this._hasSelection) {
            this._deleteSelection();
        }

        // Update internal buffer (for simulation)
        this._textBuffer = this._textBuffer.slice(0, this._cursorPosition) +
                          text +
                          this._textBuffer.slice(this._cursorPosition);
        this._cursorPosition += text.length;

        // Send to IBus if available
        this._sendKeySequence(text);

        // Update current word and predictions
        this._updateCurrentWord();
        this.updateSuggestions();

        this.emit('text-inserted', text);
        log(`[betterKeys] Inserted text: "${text}" at position ${this._cursorPosition}`);
    }

    /**
     * Delete the character before the cursor (backspace).
     */
    backspace() {
        if (this._cursorPosition === 0) {
            return;
        }

        this._recordUndoState();

        // If there's a selection, delete it
        if (this._hasSelection) {
            this._deleteSelection();
            this.updateSuggestions();
            return;
        }

        // Delete one character before cursor
        const deletedChar = this._textBuffer.charAt(this._cursorPosition - 1);
        this._textBuffer = this._textBuffer.slice(0, this._cursorPosition - 1) +
                          this._textBuffer.slice(this._cursorPosition);
        this._cursorPosition--;

        // Send backspace via IBus
        this._sendBackspace();

        // Update predictions
        this._updateCurrentWord();
        this.updateSuggestions();

        this.emit('text-deleted', { direction: 'backward', character: deletedChar });
        log('[betterKeys] Backspace pressed');
    }

    /**
     * Delete the character after the cursor (delete key).
     */
    deleteForward() {
        if (this._cursorPosition >= this._textBuffer.length) {
            return;
        }

        this._recordUndoState();

        if (this._hasSelection) {
            this._deleteSelection();
            this.updateSuggestions();
            return;
        }

        const deletedChar = this._textBuffer.charAt(this._cursorPosition);
        this._textBuffer = this._textBuffer.slice(0, this._cursorPosition) +
                          this._textBuffer.slice(this._cursorPosition + 1);

        // Send delete via IBus
        this._sendDelete();

        // Update predictions
        this._updateCurrentWord();
        this.updateSuggestions();

        this.emit('text-deleted', { direction: 'forward', character: deletedChar });
        log('[betterKeys] Delete pressed');
    }

    /**
     * Delete the currently selected text.
     */
    _deleteSelection() {
        if (!this._hasSelection) {
            return;
        }

        const start = Math.min(this._selectionStart, this._selectionEnd);
        const end = Math.max(this._selectionStart, this._selectionEnd);
        const deletedText = this._textBuffer.slice(start, end);

        this._textBuffer = this._textBuffer.slice(0, start) + this._textBuffer.slice(end);
        this._cursorPosition = start;
        this._hasSelection = false;

        // Send delete via IBus for each character? Better to send a delete range.
        // For simplicity, we send backspace multiple times.
        for (let i = 0; i < deletedText.length; i++) {
            this._sendBackspace();
        }

        this.emit('selection-deleted', deletedText);
        log(`[betterKeys] Deleted selection: "${deletedText}"`);
    }

    /**
     * Insert a newline (Enter key).
     */
    insertNewline() {
        this._recordUndoState();
        this.insertText('\n');
        this._sendEnter();
        this.emit('newline-inserted');
        log('[betterKeys] Newline inserted');
    }

    /**
     * Insert a space character.
     */
    /**
     * Move cursor left.
     * @param {boolean} extendSelection - Whether to extend selection.
     */
    moveCursorLeft(extendSelection = false) {
        if (this._cursorPosition > 0) {
            this._updateCursorPosition(this._cursorPosition - 1, extendSelection);
        }
    }

    /**
     * Move cursor right.
     * @param {boolean} extendSelection - Whether to extend selection.
     */
    moveCursorRight(extendSelection = false) {
        if (this._cursorPosition < this._textBuffer.length) {
            this._updateCursorPosition(this._cursorPosition + 1, extendSelection);
        }
    }

    /**
     * Move cursor to start of line.
     * @param {boolean} extendSelection - Whether to extend selection.
     */
    moveCursorToStart(extendSelection = false) {
        // Simplified: move to start of buffer
        this._updateCursorPosition(0, extendSelection);
    }

    /**
     * Move cursor to end of line.
     * @param {boolean} extendSelection - Whether to extend selection.
     */
    moveCursorToEnd(extendSelection = false) {
        this._updateCursorPosition(this._textBuffer.length, extendSelection);
    }

    /**
     * Update cursor position and selection.
     * @param {number} newPosition - New cursor position.
     * @param {boolean} extendSelection - Whether to extend selection.
     */
    _updateCursorPosition(newPosition, extendSelection) {
        if (extendSelection) {
            if (!this._hasSelection) {
                // Start selection from previous cursor position
                this._selectionStart = this._cursorPosition;
                this._hasSelection = true;
            }
            this._selectionEnd = newPosition;
        } else {
            this._hasSelection = false;
        }

        this._cursorPosition = newPosition;

        // Update predictions when cursor moves (if not selecting)
        if (!extendSelection) {
            this._updateCurrentWord();
            this.updateSuggestions();
        }

        this.emit('cursor-moved', this._cursorPosition);
    }

    /**
     * Select all text.
     */
    selectAll() {
        this._selectionStart = 0;
        this._selectionEnd = this._textBuffer.length;
        this._hasSelection = true;
        this._cursorPosition = this._textBuffer.length;
        this.emit('selection-changed', { start: 0, end: this._textBuffer.length });
        log('[betterKeys] Selected all text');
    }

    /**
     * Copy selected text to clipboard.
     */
    copy() {
        if (!this._hasSelection || !this._clipboard) {
            return;
        }

        const start = Math.min(this._selectionStart, this._selectionEnd);
        const end = Math.max(this._selectionStart, this._selectionEnd);
        const text = this._textBuffer.slice(start, end);

        this._clipboard.set_text(text, -1);
        this.emit('copied', text);
        log(`[betterKeys] Copied to clipboard: "${text}"`);
    }

    /**
     * Cut selected text (copy and delete).
     */
    cut() {
        if (!this._hasSelection) {
            return;
        }

        this.copy();
        this._deleteSelection();
        this.emit('cut');
        log('[betterKeys] Cut selection');
    }

    /**
     * Paste text from clipboard.
     */
    paste() {
        if (!this._clipboard) {
            return;
        }

        this._clipboard.request_text((clipboard, text) => {
            if (text) {
                this.insertText(text);
                this.emit('pasted', text);
                log(`[betterKeys] Pasted from clipboard: "${text}"`);
            }
        });
    }

    /**
     * Undo the last operation.
     */
    undo() {
        if (this._undoStack.length === 0) {
            return;
        }

        const state = this._undoStack.pop();
        this._redoStack.push(this._captureState());

        this._restoreState(state);
        this.emit('undo', state);
        log('[betterKeys] Undo performed');
    }

    /**
     * Redo the last undone operation.
     */
    redo() {
        if (this._redoStack.length === 0) {
            return;
        }

        const state = this._redoStack.pop();
        this._undoStack.push(this._captureState());

        this._restoreState(state);
        this.emit('redo', state);
        log('[betterKeys] Redo performed');
    }

    /**
     * Record current state for undo.
     */
    _recordUndoState() {
        const state = this._captureState();
        this._undoStack.push(state);
        this._redoStack = []; // Clear redo stack on new action

        // Limit undo stack size
        if (this._undoStack.length > this._maxUndoSteps) {
            this._undoStack.shift();
        }
    }

    /**
     * Capture current text state.
     * @returns {Object} State object.
     */
    _captureState() {
        return {
            text: this._textBuffer,
            cursorPosition: this._cursorPosition,
            selectionStart: this._selectionStart,
            selectionEnd: this._selectionEnd,
            hasSelection: this._hasSelection
        };
    }

    /**
     * Restore state from captured state.
     * @param {Object} state - State object.
     */
    _restoreState(state) {
        this._textBuffer = state.text;
        this._cursorPosition = state.cursorPosition;
        this._selectionStart = state.selectionStart;
        this._selectionEnd = state.selectionEnd;
        this._hasSelection = state.hasSelection;
    }

    /**
     * Send key sequence via IBus.
     * @param {string} text - Text to send.
     */
    _sendKeySequence(text) {
        if (!this._ibus) {
            return;
        }

        try {
            // For each character, simulate key press
            for (let i = 0; i < text.length; i++) {
                const char = text.charAt(i);
                // This is a simplified simulation; real IBus integration would be more complex
                this._ibus.process_key_event(char.charCodeAt(0), 0, 0);
            }
        } catch (error) {
            logError(`[betterKeys] Failed to send key sequence: ${error}`);
        }
    }

    /**
     * Send backspace via IBus.
     */
    _sendBackspace() {
        if (!this._ibus) {
            return;
        }

        try {
            // Backspace key code (0xFF08)
            this._ibus.process_key_event(0xFF08, 0, 0);
        } catch (error) {
            logError(`[betterKeys] Failed to send backspace: ${error}`);
        }
    }

    /**
     * Send delete via IBus.
     */
    _sendDelete() {
        if (!this._ibus) {
            return;
        }

        try {
            // Delete key code (0xFFFF)
            this._ibus.process_key_event(0xFFFF, 0, 0);
        } catch (error) {
            logError(`[betterKeys] Failed to send delete: ${error}`);
        }
    }

    /**
     * Send enter via IBus.
     */
    _sendEnter() {
        if (!this._ibus) {
            return;
        }

        try {
            // Enter key code (0xFF0D)
            this._ibus.process_key_event(0xFF0D, 0, 0);
        } catch (error) {
            logError(`[betterKeys] Failed to send enter: ${error}`);
        }
    }

    /**
     * Get current text buffer (for debugging).
     * @returns {string} Current text.
     */
    getText() {
        return this._textBuffer;
    }

    /**
     * Get cursor position.
     * @returns {number} Cursor position.
     */
    getCursorPosition() {
        return this._cursorPosition;
    }

    /**
     * Get selection range.
     * @returns {Object|null} Selection range or null.
     */
    getSelection() {
        if (!this._hasSelection) {
            return null;
        }
        return {
            start: Math.min(this._selectionStart, this._selectionEnd),
            end: Math.max(this._selectionStart, this._selectionEnd)
        };
    }

    /**
     * Clear text buffer and reset state.
     */
    clear() {
        this._recordUndoState();
        this._textBuffer = '';
        this._cursorPosition = 0;
        this._hasSelection = false;
        this.emit('cleared');
        log('[betterKeys] Text buffer cleared');
    }
});

// Add signals to the class
TextEngine.signals = {
    'text-inserted': { param_types: [GObject.TYPE_STRING] },
    'text-deleted': { param_types: [GObject.TYPE_POINTER] },
    'selection-deleted': { param_types: [GObject.TYPE_STRING] },
    'newline-inserted': { param_types: [] },
    'cursor-moved': { param_types: [GObject.TYPE_INT] },
    'selection-changed': { param_types: [GObject.TYPE_POINTER] },
    'copied': { param_types: [GObject.TYPE_STRING] },
    'cut': { param_types: [] },
    'pasted': { param_types: [GObject.TYPE_STRING] },
    'undo': { param_types: [GObject.TYPE_POINTER] },
    'redo': { param_types: [GObject.TYPE_POINTER] },
    'cleared': { param_types: [] },
    'suggestion-applied': { param_types: [GObject.TYPE_POINTER] }
};
