/* src/ui/input-method-bridge.js - Bridge between keyboard UI and text input */

const { GObject, St, Clutter, Shell, Meta, Gio, GLib, IBus } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const BetterKeysInputMethodBridge = GObject.registerClass(
class BetterKeysInputMethodBridge extends GObject.Object {
    _init(settingsManager) {
        super._init();
        
        this._settings = settingsManager;
        this._keyboardUI = null;
        this._focusedActor = null;
        this._ibusEngine = null;
        this._ibusConnection = null;
        this._clipboard = St.Clipboard.get_default();
        this._undoStack = [];
        this._redoStack = [];
        this._lastAction = null;
        
        // Initialize IBus connection (if available)
        this._initIBus();
        
        log('[BetterKeys] InputMethodBridge initialized');
    }
    
    _initIBus() {
        try {
            // Attempt to connect to IBus
            // This is a placeholder; actual implementation would require proper IBus setup
            log('[BetterKeys] IBus integration placeholder');
        } catch (error) {
            logError(`[BetterKeys] Failed to initialize IBus: ${error}`);
        }
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
        }
    }
    
    _onKeyPressed(keyboard, keyLabel) {
        log(`[BetterKeys] InputMethodBridge received key: ${keyLabel}`);
        
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
    
    /**
     * Insert text at the current cursor position.
     * @param {string} text - Text to insert.
     */
    _insertText(text) {
        // Try to use IBus first
        if (this._ibusEngine) {
            this._ibusEngine.process_key_event(text.charCodeAt(0), 0, 0);
            return;
        }
        
        // Fallback: simulate key events via DBus or focus
        this._simulateKeyPress(text);
        
        // Record for undo
        this._recordAction('insert', { text });
    }
    
    /**
     * Delete character before cursor (backspace).
     */
    _backspace() {
        // Simulate Backspace key
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
        // This is a placeholder; actual implementation would use
        // global.stage.get_key_focus() and inject events
        
        log(`[BetterKeys] Would simulate key press: ${key} (backspace: ${isBackspace})`);
        
        // For now, we'll attempt to use the clipboard as a hacky workaround
        // Not recommended for production
        
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
                logError(`[BetterKeys] Failed to manipulate text: ${e}`);
            }
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
        } catch (e) {}
        
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
            logError(`[BetterKeys] Failed to replace selection: ${e}`);
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
        log(`[BetterKeys] Copied to clipboard: ${text}`);
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
        
        log('[BetterKeys] Undo performed');
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
        
        log('[BetterKeys] Redo performed');
    }
    
    _applyUndoInsert(action) {
        // Simplified: just backspace
        this._backspace();
    }
    
    _applyUndoBackspace(action) {
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
     * Switch to a different input method (language/layout).
     * @param {string} inputMethodId - IBus engine ID.
     */
    switchInputMethod(inputMethodId) {
        log(`[BetterKeys] Switching input method to ${inputMethodId}`);
        // Placeholder
    }
    
    /**
     * Update cursor position tracking.
     */
    updateCursorPosition() {
        // Could be called periodically or on focus change
    }
    
    destroy() {
        if (this._ibusConnection) {
            // Disconnect IBus
        }
        
        this._undoStack = [];
        this._redoStack = [];
        
        log('[BetterKeys] InputMethodBridge destroyed');
    }
});

// Export the InputMethodBridge class
var InputMethodBridge = BetterKeysInputMethodBridge;
