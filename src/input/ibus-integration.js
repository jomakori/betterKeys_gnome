/* src/input/ibus-integration.js - IBus integration for betterKeys */

const { GObject, GLib, Gio, IBus } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const betterKeysIBusIntegration = GObject.registerClass(
class betterKeysIBusIntegration extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._ibusConnection = null;
        this._ibusEngine = null;
        this._ibusPanel = null;
        this._isConnected = false;
        this._engineName = 'betterkeys';
        this._engineDesc = 'betterKeys Virtual Keyboard';
        this._language = 'en';
        this._inputMode = 'default';
        this._preeditText = '';
        this._preeditCursorPos = 0;
        this._lookupTable = null;
        this._candidateList = [];
        this._focusInId = 0;
        this._focusOutId = 0;
        this._commitTextId = 0;

        // Load settings
        this._loadSettings();

        // Attempt to connect to IBus
        this._connectToIBus();

        log('[betterKeys] IBusIntegration initialized');
    }

    _loadSettings() {
        this._language = this._settings.getString('ibus-language') || 'en';
        this._inputMode = this._settings.getString('ibus-input-mode') || 'default';
        const enabled = this._settings.getBoolean('ibus-enabled');
        if (enabled) {
            this.enable();
        } else {
            this.disable();
        }
    }

    _connectToIBus() {
        try {
            // Create IBus connection
            this._ibusConnection = new IBus.Bus();
            this._ibusConnection.connect('connected', this._onIBusConnected.bind(this));
            this._ibusConnection.connect('disconnected', this._onIBusDisconnected.bind(this));

            // Connect to the session bus
            this._ibusConnection.connect_sync();

            log('[betterKeys] Attempting to connect to IBus...');
        } catch (error) {
            logError(`[betterKeys] Failed to create IBus connection: ${error}`);
            this._ibusConnection = null;
        }
    }

    _onIBusConnected() {
        this._isConnected = true;
        log('[betterKeys] Connected to IBus');

        // Register engine
        this._registerEngine();

        // Connect to signals
        this._connectSignals();
    }

    _onIBusDisconnected() {
        this._isConnected = false;
        log('[betterKeys] Disconnected from IBus');
    }

    _registerEngine() {
        if (!this._isConnected || !this._ibusConnection) return;

        try {
            // Create engine description
            const engineDesc = new IBus.EngineDesc(
                `ibus-${this._engineName}`,
                this._engineName,
                this._engineDesc,
                this._language,
                'en',
                '', // license
                '', // author
                '', // icon
                ''  // layout
            );

            // Register engine
            this._ibusConnection.register_engine(engineDesc);

            // Create engine instance
            this._ibusEngine = new IBus.Engine();
            this._ibusEngine.set_property('engine-name', this._engineName);
            this._ibusEngine.set_property('label', 'BK');

            // Connect engine signals
            this._ibusEngine.connect('process-key-event', this._onProcessKeyEvent.bind(this));
            this._ibusEngine.connect('focus-in', this._onFocusIn.bind(this));
            this._ibusEngine.connect('focus-out', this._onFocusOut.bind(this));
            this._ibusEngine.connect('reset', this._onReset.bind(this));
            this._ibusEngine.connect('enable', this._onEnable.bind(this));
            this._ibusEngine.connect('disable', this._onDisable.bind(this));
            this._ibusEngine.connect('set-capabilities', this._onSetCapabilities.bind(this));

            // Set engine capabilities
            const caps = IBus.Capability.PREEDIT_TEXT |
                         IBus.Capability.FOCUS |
                         IBus.Capability.LOOKUP_TABLE;
            this._ibusEngine.set_capabilities(caps);

            log(`[betterKeys] IBus engine registered: ${this._engineName}`);
        } catch (error) {
            logError(`[betterKeys] Failed to register IBus engine: ${error}`);
        }
    }

    _connectSignals() {
        if (!this._ibusConnection) return;

        // Connect to panel signals
        this._ibusPanel = this._ibusConnection.get_panel();
        if (this._ibusPanel) {
            this._ibusPanel.connect('focus-in', this._onPanelFocusIn.bind(this));
            this._ibusPanel.connect('focus-out', this._onPanelFocusOut.bind(this));
            this._ibusPanel.connect('register-properties', this._onRegisterProperties.bind(this));
        }
    }

    _onProcessKeyEvent(engine, keyval, keycode, state) {
        log(`[betterKeys] IBus process-key-event: keyval=${keyval}, keycode=${keycode}, state=${state}`);

        // Forward to keyboard UI if needed
        this.emit('key-event', keyval, keycode, state);

        // Return false to let IBus handle it, true if we consumed it
        return false;
    }

    _onFocusIn(engine) {
        log('[betterKeys] IBus focus-in');
        this.emit('focus-in');
    }

    _onFocusOut(engine) {
        log('[betterKeys] IBus focus-out');
        this.emit('focus-out');
    }

    _onReset(engine) {
        log('[betterKeys] IBus reset');
        this._preeditText = '';
        this._preeditCursorPos = 0;
        this._clearLookupTable();
        this.emit('reset');
    }

    _onEnable(engine) {
        log('[betterKeys] IBus engine enabled');
        this.emit('enabled');
    }

    _onDisable(engine) {
        log('[betterKeys] IBus engine disabled');
        this.emit('disabled');
    }

    _onSetCapabilities(engine, caps) {
        log(`[betterKeys] IBus capabilities set: ${caps}`);
    }

    _onPanelFocusIn(panel, inputContextPath) {
        log(`[betterKeys] Panel focus-in: ${inputContextPath}`);
    }

    _onPanelFocusOut(panel, inputContextPath) {
        log(`[betterKeys] Panel focus-out: ${inputContextPath}`);
    }

    _onRegisterProperties(panel, props) {
        log(`[betterKeys] Panel register-properties: ${props}`);
    }

    _clearLookupTable() {
        if (this._lookupTable) {
            this._lookupTable = null;
        }
        this._candidateList = [];
    }

    /**
     * Enable IBus integration.
     */
    enable() {
        if (this._isConnected) return;

        this._connectToIBus();
        log('[betterKeys] IBus integration enabled');
    }

    /**
     * Disable IBus integration.
     */
    disable() {
        if (this._ibusConnection) {
            try {
                this._ibusConnection.disconnect();
            } catch (e) {}
            this._ibusConnection = null;
        }
        this._isConnected = false;
        log('[betterKeys] IBus integration disabled');
    }

    /**
     * Send text to active input field via IBus.
     * @param {string} text - Text to commit.
     */
    commitText(text) {
        if (!this._isConnected || !this._ibusEngine) {
            log(`[betterKeys] Cannot commit text, IBus not ready: ${text}`);
            return;
        }

        try {
            const ibusText = new IBus.Text();
            ibusText.set_text(text);
            this._ibusEngine.commit_text(ibusText);
            log(`[betterKeys] Committed text via IBus: ${text}`);
        } catch (error) {
            logError(`[betterKeys] Failed to commit text via IBus: ${error}`);
        }
    }

    /**
     * Update pre‑edit text (composition).
     * @param {string} text - Pre‑edit text.
     * @param {number} cursorPos - Cursor position within pre‑edit text.
     */
    updatePreedit(text, cursorPos = 0) {
        if (!this._isConnected || !this._ibusEngine) return;

        this._preeditText = text;
        this._preeditCursorPos = cursorPos;

        const ibusText = new IBus.Text();
        ibusText.set_text(text);

        // Show pre‑edit
        this._ibusEngine.update_preedit_text(ibusText, cursorPos, true);
        log(`[betterKeys] Updated pre‑edit: "${text}" cursor ${cursorPos}`);
    }

    /**
     * Hide pre‑edit text.
     */
    hidePreedit() {
        if (!this._isConnected || !this._ibusEngine) return;

        const ibusText = new IBus.Text();
        ibusText.set_text('');
        this._ibusEngine.update_preedit_text(ibusText, 0, false);
        this._preeditText = '';
        this._preeditCursorPos = 0;
    }

    /**
     * Show a lookup table with candidates (e.g., for predictions).
     * @param {Array} candidates - Array of candidate strings.
     * @param {number} selectedIndex - Initially selected candidate index.
     */
    showLookupTable(candidates, selectedIndex = 0) {
        if (!this._isConnected || !this._ibusEngine) return;

        this._clearLookupTable();
        this._candidateList = candidates;

        this._lookupTable = new IBus.LookupTable();
        this._lookupTable.set_page_size(10);
        this._lookupTable.set_orientation(IBus.Orientation.HORIZONTAL);

        candidates.forEach((candidate, idx) => {
            const text = new IBus.Text();
            text.set_text(candidate);
            this._lookupTable.append_candidate(text);
        });

        this._lookupTable.set_cursor_pos(selectedIndex);
        this._ibusEngine.update_lookup_table(this._lookupTable, true);

        log(`[betterKeys] Lookup table shown with ${candidates.length} candidates`);
    }

    /**
     * Hide lookup table.
     */
    hideLookupTable() {
        if (!this._isConnected || !this._ibusEngine || !this._lookupTable) return;

        this._ibusEngine.update_lookup_table(this._lookupTable, false);
        this._clearLookupTable();
        log('[betterKeys] Lookup table hidden');
    }

    /**
     * Get current IBus engine ID.
     * @returns {string} Engine ID.
     */
    getEngineId() {
        return this._engineName;
    }

    /**
     * Get current language.
     * @returns {string} Language code.
     */
    getLanguage() {
        return this._language;
    }

    /**
     * Set language for IBus engine.
     * @param {string} language - Language code (e.g., 'en', 'fr').
     */
    setLanguage(language) {
        this._language = language;
        this._settings.setString('ibus-language', language);
        log(`[betterKeys] IBus language set to ${language}`);
    }

    /**
     * Set input mode.
     * @param {string} mode - Input mode ('default', 'direct', 'preedit').
     */
    setInputMode(mode) {
        this._inputMode = mode;
        this._settings.setString('ibus-input-mode', mode);
        log(`[betterKeys] IBus input mode set to ${mode}`);
    }

    /**
     * Check if IBus is connected.
     * @returns {boolean} True if connected.
     */
    isConnected() {
        return this._isConnected;
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

    destroy() {
        this.disable();

        if (this._focusInId) {
            GLib.source_remove(this._focusInId);
            this._focusInId = 0;
        }
        if (this._focusOutId) {
            GLib.source_remove(this._focusOutId);
            this._focusOutId = 0;
        }
        if (this._commitTextId) {
            GLib.source_remove(this._commitTextId);
            this._commitTextId = 0;
        }

        log('[betterKeys] IBusIntegration destroyed');
    }
});

// Add signals to the class
betterKeysIBusIntegration.signals = {
    'key-event': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_UINT] },
    'focus-in': { param_types: [] },
    'focus-out': { param_types: [] },
    'reset': { param_types: [] },
    'enabled': { param_types: [] },
    'disabled': { param_types: [] },
    'connected': { param_types: [] },
    'disconnected': { param_types: [] }
};
