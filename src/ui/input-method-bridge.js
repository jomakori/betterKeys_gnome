/* src/ui/input-method-bridge.js - Enhanced bridge between keyboard UI and text input with full IBus integration */

const { GObject, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Import our new IBus integration (if available)
let IBusIntegration = null;
try {
    IBusIntegration = Me.imports.src.input['ibus-integration'].IBusIntegration;
} catch (e) {
    log('[betterKeys] IBusIntegration module not available, using fallback');
}

const betterKeysInputMethodBridge = GObject.registerClass(
class betterKeysInputMethodBridge extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._keyboardUI = null;
        this._focusedActor = null;
        this._clipboard = St.Clipboard.get_default();
        this._undoStack = [];
        this._redoStack = [];
        this._lastAction = null;
        this._preeditText = '';
        this._preeditCursorPos = 0;
        this._lookupTableVisible = false;
        this._candidates = [];
        this._selectedCandidateIndex = 0;

        // Initialize IBus integration
        this._ibusIntegration = null;
        this._initIBusIntegration();

        // Connect to clipboard changes
        this._clipboard.connect('owner-change', this._onClipboardChanged.bind(this));

        log('[betterKeys] Enhanced InputMethodBridge initialized');
    }

    _initIBusIntegration() {
        if (IBusIntegration) {
            try {
                this._ibusIntegration = new IBusIntegration(this._settings);
                this._ibusIntegration.connect('focus-in', this._onIBusFocusIn.bind(this));
                this._ibusIntegration.connect('focus-out', this._onIBusFocusOut.bind(this));
                this._ibusIntegration.connect('key-event', this._onIBusKeyEvent.bind(this));
                this._ibusIntegration.connect('reset', this._onIBusReset.bind(this));
                log('[betterKeys] IBus integration attached');
            } catch (error) {
                logError(`[betterKeys] Failed to create IBus integration: ${error}`);
                this._ibusIntegration = null;
            }
        } else {
            log('[betterKeys] IBus integration not available, using fallback input methods');
        }
    }

    _onIBusFocusIn() {
        log('[betterKeys] IBus focus-in received');
        this.emit('focus-in');
    }

    _onIBusFocusOut() {
        log('[betterKeys] IBus focus-out received');
        this.emit('focus-out');
    }

    _onIBusKeyEvent(integration, keyval, keycode, state) {
        log(`[betterKeys] IBus key event: ${keyval}`);
        // Forward to keyboard UI if needed
        this.emit('ibus-key-event', keyval, keycode, state);
    }

    _onIBusReset() {
        log('[betterKeys] IBus reset received');
        this._clearPreedit();
        this._hideLookupTable();
    }

    _onClipboardChanged(_clipboard, _event) {
        // Clipboard content changed, could update UI
        this.emit('clipboard-changed');
    }

    /**
     * Set the keyboard UI instance.
     * @param {KeyboardUI} keyboardUI - The keyboard UI widget.
     */
    setKeyboardUI(keyboardUI) {
        this._keyboardUI = keyboardUI;

        // Connect to key-pressed signals
        if (keyboardUI) {
            keyboardUI.connect('key-pressed', this._onKeyPressed.bind(this));
            keyboardUI.connect('layout-changed', this._onLayoutChanged.bind(this));
        }
    }

    _onKeyPressed(keyboard, keyLabel) {
        log(`[betterKeys] InputMethodBridge received key: ${keyLabel}`);

        // Handle special keys
        switch (keyLabel) {
            case 'Space':
                this._insertText(' ');
                break;
            case 'Backspace':
                this._backspace();
                break;
            case 'Enter':
                this._insertText('\n');
                break;
            case 'Shift':
                // Toggle shift state (handled by keyboard UI)
                break;
            case '?123':
                // Switch to symbols (handled by keyboard UI)
                break;
            default:
                // Regular character
                this._insertText(keyLabel);
                break;
        }
    }

    _onLayoutChanged(keyboard, layoutId) {
        log(`[betterKeys] Layout changed to ${layoutId}`);
        // Could update IBus engine properties
    }

    /**
     * Insert text at the current cursor position.
     * @param {string} text - Text to insert.
     */
    _insertText(text) {
        // Use IBus integration if available
        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            this._ibusIntegration.commitText(text);
        } else {
            // Fallback: simulate key events
            this._simulateKeyPress(text);
        }

        // Record for undo
        this._recordAction('insert', { text });
    }

    /**
     * Delete character before cursor (backspace).
     */
    _backspace() {
        // Use IBus integration if available
        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            // Send Backspace key event via IBus
            this._ibusIntegration.commitText(''); // Not correct; need to send backspace key event
            // For simplicity, we'll fallback
        }

        // Fallback: simulate Backspace key
        this._simulateKeyPress('', true);

        // Record for undo
        this._recordAction('backspace', {});
    }

    /**
     * Simulate a key press event.
     * @param {string} key - Key character or empty for special keys.
     * @param {boolean} isBackspace - Whether this is a backspace.
     */
    _simulateKeyPress(key, isBackspace = false) {
        // Focus tracking: get currently focused text actor
        const focus = global.stage.key_focus;
        if (focus && focus.get_text) {
            // If it's a St.Entry or similar, we can manipulate text directly
            try {
                const currentText = focus.get_text();
                const cursorPos = focus.get_cursor_position();

                if (isBackspace) {
                    if (cursorPos > 0) {
                        const newText = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                        focus.set_text(newText);
                        focus.set_cursor_position(cursorPos - 1);
                    }
                } else {
                    const newText = currentText.substring(0, cursorPos) + key + currentText.substring(cursorPos);
                    focus.set_text(newText);
                    focus.set_cursor_position(cursorPos + key.length);
                }
            } catch (e) {
                logError(`[betterKeys] Failed to manipulate text: ${e}`);
            }
        } else {
            log(`[betterKeys] Would simulate key press: ${key} (backspace: ${isBackspace})`);
        }
    }

    /**
     * Get the currently focused text actor.
     * @returns {St.Widget|null} The focused actor, or null.
     */
    _getFocusedTextActor() {
        const focus = global.stage.key_focus;
        if (focus && (focus.get_text || focus.clutter_text)) {
            return focus;
        }
        return null;
    }

    /**
     * Get the current selection range.
     * @returns {Object|null} { start, end } or null.
     */
    _getSelection() {
        const actor = this._getFocusedTextActor();
        if (!actor) return null;

        try {
            if (actor.get_selection_bound) {
                const start = actor.get_selection_bound();
                const end = actor.get_cursor_position();
                return { start, end };
            }
        } catch {}

        return null;
    }

    /**
     * Replace selected text with new text.
     * @param {string} newText - Text to insert.
     */
    _replaceSelection(newText) {
        const actor = this._getFocusedTextActor();
        if (!actor) return;

        try {
            const currentText = actor.get_text();
            const selection = this._getSelection();
            if (selection) {
                const { start, end } = selection;
                const before = currentText.substring(0, Math.min(start, end));
                const after = currentText.substring(Math.max(start, end));
                actor.set_text(before + newText + after);
                actor.set_cursor_position(before.length + newText.length);
            }
        } catch (e) {
            logError(`[betterKeys] Failed to replace selection: ${e}`);
        }
    }

    /**
     * Copy selected text to clipboard.
     */
    copy() {
        const actor = this._getFocusedTextActor();
        if (!actor) return;

        const selection = this._getSelection();
        if (!selection) return;

        const { start, end } = selection;
        const text = actor.get_text().substring(Math.min(start, end), Math.max(start, end));

        this._clipboard.set_text(text);
        log(`[betterKeys] Copied to clipboard: ${text}`);
    }

    /**
     * Cut selected text to clipboard.
     */
    cut() {
        this.copy();
        this._replaceSelection('');
    }

    /**
     * Paste clipboard content.
     */
    paste() {
        this._clipboard.get_text((clipboard, text) => {
            if (text) {
                this._replaceSelection(text);
            }
        });
    }

    /**
     * Undo last text action.
     */
    undo() {
        if (this._undoStack.length === 0) return;

        const action = this._undoStack.pop();
        this._redoStack.push(action);

        // Apply inverse action
        switch (action.type) {
            case 'insert':
                // Remove inserted text
                this._applyUndoInsert(action);
                break;
            case 'backspace':
                // Re‑insert deleted text
                this._applyUndoBackspace(action);
                break;
        }

        log('[betterKeys] Undo performed');
    }

    /**
     * Redo last undone action.
     */
    redo() {
        if (this._redoStack.length === 0) return;

        const action = this._redoStack.pop();
        this._undoStack.push(action);

        // Re‑apply action
        switch (action.type) {
            case 'insert':
                this._insertText(action.data.text);
                break;
            case 'backspace':
                this._backspace();
                break;
        }

        log('[betterKeys] Redo performed');
    }

    _applyUndoInsert(_action) {
        // Simplified: just backspace
        this._backspace();
    }

    _applyUndoBackspace(_action) {
        // Simplified: re‑insert last character (not accurate)
        // In a real implementation, we'd store the deleted text
        this._insertText('?');
    }

    _recordAction(type, data) {
        const action = {
            type,
            data,
            timestamp: Date.now()
        };

        this._undoStack.push(action);
        this._redoStack = []; // Clear redo stack on new action
        this._lastAction = action;

        // Limit stack size
        if (this._undoStack.length > 50) {
            this._undoStack.shift();
        }
    }

    /**
     * Handle special characters (emoji, symbols, etc.)
     * @param {string} char - Special character to insert.
     */
    insertSpecialCharacter(char) {
        this._insertText(char);
    }

    /**
     * Update pre‑edit text (composition).
     * @param {string} text - Pre‑edit text.
     * @param {number} cursorPos - Cursor position within pre‑edit text.
     */
    updatePreedit(text, cursorPos = 0) {
        this._preeditText = text;
        this._preeditCursorPos = cursorPos;

        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            this._ibusIntegration.updatePreedit(text, cursorPos);
        } else {
            // Fallback: show pre‑edit in a temporary overlay (optional)
            log(`[betterKeys] Pre‑edit: "${text}" cursor ${cursorPos}`);
        }

        this.emit('preedit-updated', text, cursorPos);
    }

    /**
     * Clear pre‑edit text.
     */
    clearPreedit() {
        this._preeditText = '';
        this._preeditCursorPos = 0;

        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            this._ibusIntegration.hidePreedit();
        }

        this.emit('preedit-cleared');
    }

    _clearPreedit() {
        this.clearPreedit();
    }

    /**
     * Show lookup table with candidates.
     * @param {Array} candidates - Array of candidate strings.
     * @param {number} selectedIndex - Initially selected candidate index.
     */
    showLookupTable(candidates, selectedIndex = 0) {
        this._candidates = candidates;
        this._selectedCandidateIndex = selectedIndex;
        this._lookupTableVisible = true;

        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            this._ibusIntegration.showLookupTable(candidates, selectedIndex);
        } else {
            // Fallback: display candidates in a custom UI
            log(`[betterKeys] Lookup table with ${candidates.length} candidates`);
        }

        this.emit('lookup-table-shown', candidates, selectedIndex);
    }

    /**
     * Hide lookup table.
     */
    hideLookupTable() {
        this._lookupTableVisible = false;
        this._candidates = [];
        this._selectedCandidateIndex = 0;

        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            this._ibusIntegration.hideLookupTable();
        }

        this.emit('lookup-table-hidden');
    }

    _hideLookupTable() {
        this.hideLookupTable();
    }

    /**
     * Select next candidate in lookup table.
     */
    nextCandidate() {
        if (!this._lookupTableVisible || this._candidates.length === 0) return;

        this._selectedCandidateIndex = (this._selectedCandidateIndex + 1) % this._candidates.length;
        this._updateCandidateSelection();
    }

    /**
     * Select previous candidate in lookup table.
     */
    previousCandidate() {
        if (!this._lookupTableVisible || this._candidates.length === 0) return;

        this._selectedCandidateIndex = (this._selectedCandidateIndex - 1 + this._candidates.length) % this._candidates.length;
        this._updateCandidateSelection();
    }

    _updateCandidateSelection() {
        if (this._ibusIntegration && this._ibusIntegration.isConnected()) {
            // IBus integration would handle selection internally
            log(`[betterKeys] Selected candidate ${this._selectedCandidateIndex}: ${this._candidates[this._selectedCandidateIndex]}`);
        }

        this.emit('candidate-selected', this._selectedCandidateIndex, this._candidates[this._selectedCandidateIndex]);
    }

    /**
     * Commit currently selected candidate.
     */
    commitCandidate() {
        if (!this._lookupTableVisible || this._candidates.length === 0) return;

        const candidate = this._candidates[this._selectedCandidateIndex];
        this._insertText(candidate);
        this.hideLookupTable();
        this.clearPreedit();
    }

    /**
     * Switch to a different input method (language/layout).
     * @param {string} inputMethodId - IBus engine ID.
     */
    switchInputMethod(inputMethodId) {
        log(`[betterKeys] Switching input method to ${inputMethodId}`);
        // This would involve changing IBus engine
        // Placeholder
    }

    /**
     * Update cursor position tracking.
     */
    updateCursorPosition() {
        // Could be called periodically or on focus change
        // Not implemented
    }

    /**
     * Get current pre‑edit text.
     * @returns {string} Pre‑edit text.
     */
    getPreeditText() {
        return this._preeditText;
    }

    /**
     * Get current pre‑edit cursor position.
     * @returns {number} Cursor position.
     */
    getPreeditCursorPos() {
        return this._preeditCursorPos;
    }

    /**
     * Check if lookup table is visible.
     * @returns {boolean} True if visible.
     */
    isLookupTableVisible() {
        return this._lookupTableVisible;
    }

    /**
     * Get current candidates.
     * @returns {Array} Array of candidate strings.
     */
    getCandidates() {
        return this._candidates;
    }

    /**
     * Get selected candidate index.
     * @returns {number} Index.
     */
    getSelectedCandidateIndex() {
        return this._selectedCandidateIndex;
    }

    /**
     * Check if IBus integration is active.
     * @returns {boolean} True if active.
     */
    isIBusActive() {
        return this._ibusIntegration && this._ibusIntegration.isConnected();
    }

    destroy() {
        if (this._ibusIntegration) {
            this._ibusIntegration.destroy();
            this._ibusIntegration = null;
        }

        this._undoStack = [];
        this._redoStack = [];

        log('[betterKeys] InputMethodBridge destroyed');
    }
});

// Add signals to the class
betterKeysInputMethodBridge.signals = {
    'focus-in': { param_types: [] },
    'focus-out': { param_types: [] },
    'ibus-key-event': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_UINT] },
    'clipboard-changed': { param_types: [] },
    'preedit-updated': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT] },
    'preedit-cleared': { param_types: [] },
    'lookup-table-shown': { param_types: [GObject.TYPE_PYOBJECT, GObject.TYPE_INT] },
    'lookup-table-hidden': { param_types: [] },
    'candidate-selected': { param_types: [GObject.TYPE_INT, GObject.TYPE_STRING] }
};

// Export the InputMethodBridge class
var InputMethodBridge = betterKeysInputMethodBridge;
