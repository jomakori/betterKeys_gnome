/* src/input/voice-input.js - Voice input integration for betterKeys */

const { GObject, St, Clutter, Gio, GLib, Gdk } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var VoiceInputManager = GObject.registerClass(
class VoiceInputManager extends GObject.Object {
    _init(settingsManager, inputBridge) {
        super._init();

        this._settings = settingsManager;
        this._inputBridge = inputBridge;
        this._isListening = false;
        this._microphonePermission = false;
        this._voiceRecognitionEngine = null;
        this._voiceButton = null;
        this._language = 'en-US';
        this._sensitivity = 0.5;
        this._timeoutId = 0;
        this._recognitionTimeout = 10000; // 10 seconds max

        // Load settings
        this._loadSettings();

        // Check for microphone permission (placeholder)
        this._checkMicrophonePermission();

        log('[betterKeys] VoiceInputManager initialized');
    }

    _loadSettings() {
        this._language = this._settings.getString('voice-input-language') || 'en-US';
        this._sensitivity = this._settings.getDouble('voice-input-sensitivity') || 0.5;
        const enabled = this._settings.getBoolean('voice-input-enabled');
        if (enabled) {
            this.enable();
        } else {
            this.disable();
        }
    }

    _checkMicrophonePermission() {
        // This is a placeholder; actual implementation would query system permissions
        // For GNOME, we might check via Portals or GSettings
        this._microphonePermission = true; // Assume granted for now
        log(`[betterKeys] Microphone permission: ${this._microphonePermission}`);
    }

    /**
     * Enable voice input.
     */
    enable() {
        if (!this._microphonePermission) {
            logError('[betterKeys] Cannot enable voice input: microphone permission denied');
            return;
        }

        // Create voice button if not exists
        this._createVoiceButton();

        log('[betterKeys] Voice input enabled');
    }

    /**
     * Disable voice input.
     */
    disable() {
        this.stopListening();
        if (this._voiceButton) {
            this._voiceButton.destroy();
            this._voiceButton = null;
        }
        log('[betterKeys] Voice input disabled');
    }

    _createVoiceButton() {
        if (this._voiceButton) return;

        // Create a floating button that can be placed on the keyboard
        this._voiceButton = new St.Button({
            style_class: 'betterkeys-voice-button',
            reactive: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.END,
            width: 48,
            height: 48,
            label: '🎤'
        });

        this._voiceButton.connect('clicked', this._onVoiceButtonClicked.bind(this));
        this._voiceButton.connect('enter-event', this._onVoiceButtonHover.bind(this));
        this._voiceButton.connect('leave-event', this._onVoiceButtonLeave.bind(this));

        // Add to the stage (temporary, will be attached to keyboard UI later)
        Main.uiGroup.add_child(this._voiceButton);
        this._voiceButton.hide();

        log('[betterKeys] Voice button created');
    }

    /**
     * Attach voice button to keyboard UI.
     * @param {KeyboardUI} keyboardUI - The keyboard UI widget.
     */
    attachToKeyboard(keyboardUI) {
        if (!this._voiceButton) return;

        // Remove from stage and add as child of keyboard
        Main.uiGroup.remove_child(this._voiceButton);
        keyboardUI.add_child(this._voiceButton);

        // Position at bottom-right corner
        this._voiceButton.x = keyboardUI.width - this._voiceButton.width - 10;
        this._voiceButton.y = keyboardUI.height - this._voiceButton.height - 10;

        this._voiceButton.show();
        log('[betterKeys] Voice button attached to keyboard');
    }

    _onVoiceButtonClicked() {
        if (this._isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    _onVoiceButtonHover() {
        this._voiceButton.add_style_class_name('betterkeys-voice-button-hover');
    }

    _onVoiceButtonLeave() {
        this._voiceButton.remove_style_class_name('betterkeys-voice-button-hover');
    }

    /**
     * Start listening for voice input.
     */
    startListening() {
        if (this._isListening) return;

        if (!this._microphonePermission) {
            logError('[betterKeys] Cannot start listening: microphone permission denied');
            return;
        }

        this._isListening = true;
        this._voiceButton.add_style_class_name('betterkeys-voice-button-listening');
        this._voiceButton.label = '🔴';

        // Simulate voice recognition (placeholder)
        log(`[betterKeys] Voice listening started (language: ${this._language})`);

        // Set a timeout to stop listening automatically
        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._recognitionTimeout, () => {
            this.stopListening();
            return GLib.SOURCE_REMOVE;
        });

        this.emit('listening-started');
    }

    /**
     * Stop listening and process captured audio.
     */
    stopListening() {
        if (!this._isListening) return;

        this._isListening = false;
        this._voiceButton.remove_style_class_name('betterkeys-voice-button-listening');
        this._voiceButton.label = '🎤';

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        // Simulate recognition result (placeholder)
        this._simulateRecognitionResult();

        this.emit('listening-stopped');
    }

    _simulateRecognitionResult() {
        // This is a placeholder that would be replaced with actual speech-to-text
        // For demonstration, we'll insert a fixed phrase
        const phrases = [
            'Hello world',
            'This is a test',
            'Voice input is working',
            'Type something interesting',
            'The quick brown fox jumps over the lazy dog'
        ];
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];

        log(`[betterKeys] Voice recognition result: "${randomPhrase}"`);

        // Insert text via input bridge
        if (this._inputBridge) {
            this._inputBridge.commitText(randomPhrase);
        }
    }

    /**
     * Process audio data (placeholder).
     * @param {Uint8Array} audioData - Raw audio samples.
     */
    processAudio(audioData) {
        // This would be implemented with a speech recognition engine
        log(`[betterKeys] Processing ${audioData.length} audio samples`);
    }

    /**
     * Set recognition language.
     * @param {string} language - BCP‑47 language tag (e.g., 'en-US', 'fr-FR').
     */
    setLanguage(language) {
        this._language = language;
        this._settings.setString('voice-input-language', language);
        log(`[betterKeys] Voice input language set to ${language}`);
    }

    /**
     * Set sensitivity threshold.
     * @param {number} sensitivity - Value between 0.0 (low) and 1.0 (high).
     */
    setSensitivity(sensitivity) {
        const clamped = Math.max(0.0, Math.min(1.0, sensitivity));
        this._sensitivity = clamped;
        this._settings.setDouble('voice-input-sensitivity', clamped);
        log(`[betterKeys] Voice sensitivity set to ${clamped}`);
    }

    /**
     * Check if voice input is currently listening.
     * @returns {boolean} True if listening.
     */
    isListening() {
        return this._isListening;
    }

    /**
     * Check if microphone permission is granted.
     * @returns {boolean} True if permission granted.
     */
    hasMicrophonePermission() {
        return this._microphonePermission;
    }

    /**
     * Request microphone permission from the user.
     */
    requestMicrophonePermission() {
        // This would show a permission dialog
        log('[betterKeys] Requesting microphone permission (placeholder)');
        this._microphonePermission = true; // Assume granted
    }

    destroy() {
        this.disable();

        if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }

        log('[betterKeys] VoiceInputManager destroyed');
    }
});

// Add signals to the class
VoiceInputManager.signals = {
    'listening-started': { param_types: [] },
    'listening-stopped': { param_types: [] },
    'recognition-result': { param_types: [GObject.TYPE_STRING] },
    'permission-changed': { param_types: [GObject.TYPE_BOOLEAN] }
};

// Export the VoiceInputManager class
// var VoiceInputManager = VoiceInputManager; // Removed duplicate identifier
