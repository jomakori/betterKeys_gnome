import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import { KeyboardUI } from './ui/keyboard.js';
import { SettingsManager } from './settings/manager.js';
import { KeyboardManager as KeyboardCoreManager } from './keyboard/manager.js';
import { InputEventHandler } from './input/handler.js';
import { LayoutManager } from './keyboard/layout-manager.js';
import { TextEngine } from './input/text-engine.js';
import { KeyPressHandler } from './input/key-press.js';
import { GestureRecognizer } from './input/gesture-recognizer.js';
import { InputValidator } from './input/validator.js';
import { EventEmitter } from './utils/event-emitter.js';
import { WindowManager } from './ui/window-manager.js';
import { VisibilityManager } from './ui/visibility-manager.js';
import { AnimationManager } from './ui/animations.js';
import { AccessibilityManager } from './ui/accessibility.js';
import { InputMethodBridge } from './ui/input-method-bridge.js';
import { ClipboardHistoryManager } from './clipboard/history-manager.js';
import { EmojiManager } from './emoji/emoji-manager.js';
import { SpecialCharsPanel } from './ui/special-chars-panel.js';
import { ThemeManagerClass } from './ui/theme-manager.js';
import { VoiceInputManager } from './input/voice-input.js';

export const KeyboardManager = GObject.registerClass(
class KeyboardManager extends GObject.Object {
    _init(extension) {
        super._init();

        this._extension = extension;
        this._settings = new SettingsManager(extension);
        this._keyboardUI = null;
        this._keyboardCore = null;
        this._inputHandler = null;
        this._layoutManager = null;
        this._textEngine = null;
        this._keyPressHandler = null;
        this._gestureRecognizer = null;
        this._inputValidator = null;
        this._eventEmitter = null;
        this._isEnabled = false;
        this._settingsChangedId = 0;

        this._windowManager = null;
        this._visibilityManager = null;
        this._animationManager = null;
        this._accessibilityManager = null;
        this._inputMethodBridge = null;

        this._clipboardHistoryManager = null;
        this._emojiManager = null;
        this._themeManager = null;
        this._voiceInput = null;
        this._specialCharsPanel = null;

        log('[betterKeys] KeyboardManager initialized');
    }

    enable() {
        if (this._isEnabled) {
            return;
        }

        log('[betterKeys] Enabling keyboard manager');

        try {
            this._eventEmitter = new EventEmitter();
            this._layoutManager = new LayoutManager();
            this._textEngine = new TextEngine(this._settings);
            this._keyPressHandler = new KeyPressHandler(this._settings);
            this._gestureRecognizer = new GestureRecognizer(this._settings);
            this._inputValidator = new InputValidator(this._settings);

            this._keyboardUI = new KeyboardUI(this._settings);

            this._windowManager = new WindowManager(this._settings);
            if (this._windowManager.setKeyboardUI) {
                this._windowManager.setKeyboardUI(this._keyboardUI);
            }
            if (this._keyboardUI.setWindowManager) {
                this._keyboardUI.setWindowManager(this._windowManager);
            }

            this._animationManager = new AnimationManager();
            if (this._animationManager.start) {
                this._animationManager.start();
            }

            this._accessibilityManager = new AccessibilityManager(this._settings);
            if (this._accessibilityManager.setKeyboardUI) {
                this._accessibilityManager.setKeyboardUI(this._keyboardUI);
            }

            this._inputMethodBridge = new InputMethodBridge(this._settings);
            if (this._inputMethodBridge.setKeyboardUI) {
                this._inputMethodBridge.setKeyboardUI(this._keyboardUI);
            }

            this._visibilityManager = new VisibilityManager(this._settings, this._windowManager);
            if (this._visibilityManager.setKeyboardUI) {
                this._visibilityManager.setKeyboardUI(this._keyboardUI);
            }
            if (this._visibilityManager.enable) {
                this._visibilityManager.enable();
            }

            this._safeInit(() => { this._clipboardHistoryManager = new ClipboardHistoryManager(this._settings); }, 'ClipboardHistory');
            this._safeInit(() => { this._emojiManager = new EmojiManager(this._settings); }, 'EmojiManager');
            if (ThemeManagerClass) {
                this._safeInit(() => { this._themeManager = new ThemeManagerClass(this._settings); }, 'ThemeManager');
            }
            if (VoiceInputManager) {
                this._safeInit(() => { this._voiceInput = new VoiceInputManager(this._settings); }, 'VoiceInput');
            }
            this._safeInit(() => { this._specialCharsPanel = new SpecialCharsPanel(this._settings); }, 'SpecialChars');

            if (this._themeManager && this._keyboardUI && this._themeManager.setKeyboardUI) {
                this._themeManager.setKeyboardUI(this._keyboardUI);
                if (this._themeManager.applyCurrentTheme) {
                    this._themeManager.applyCurrentTheme();
                }
            }

            this._inputHandler = new InputEventHandler(this._keyboardUI, this._settings);
            if (this._inputHandler.setGestureRecognizer) {
                this._inputHandler.setGestureRecognizer(this._gestureRecognizer);
            }
            if (this._inputHandler.start) {
                this._inputHandler.start();
            }

            this._keyboardCore = new KeyboardCoreManager(this._settings);
            if (this._keyboardCore.enable) {
                this._keyboardCore.enable(
                    this._keyboardUI,
                    this._inputHandler,
                    this._layoutManager,
                    this._textEngine,
                    this._keyPressHandler
                );
            }

            this._settingsChangedId = this._settings.connect('changed', this._onSettingsChanged.bind(this));

            this._isEnabled = true;
            log('[betterKeys] Keyboard manager enabled successfully');
        } catch (error) {
            logError(`[betterKeys] Failed to enable keyboard manager: ${error}`);
            logError(error.stack);
            this._attemptCleanup();
            throw error;
        }
    }

    disable() {
        if (!this._isEnabled) {
            return;
        }

        log('[betterKeys] Disabling keyboard manager');

        try {
            if (this._inputHandler && this._inputHandler.stop) {
                this._inputHandler.stop();
            }
            if (this._visibilityManager && this._visibilityManager.disable) {
                this._visibilityManager.disable();
            }
            if (this._animationManager && this._animationManager.stop) {
                this._animationManager.stop();
            }
            if (this._keyboardCore && this._keyboardCore.disable) {
                this._keyboardCore.disable();
            }
            if (this._keyboardUI && this._keyboardUI.destroy) {
                this._keyboardUI.destroy();
            }
            if (this._windowManager && this._windowManager.destroy) {
                this._windowManager.destroy();
            }
            if (this._settingsChangedId) {
                this._settings.disconnect(this._settingsChangedId);
                this._settingsChangedId = 0;
            }
            if (this._settings && this._settings.destroy) {
                this._settings.destroy();
            }

            this._isEnabled = false;
            log('[betterKeys] Keyboard manager disabled successfully');
        } catch (error) {
            logError(`[betterKeys] Failed to disable keyboard manager: ${error}`);
            logError(error.stack);
        }
    }

    hideKeyboard() {
        if (this._visibilityManager && this._visibilityManager.hide) {
            this._visibilityManager.hide();
        }
    }

    showKeyboard() {
        if (this._visibilityManager && this._visibilityManager.show) {
            this._visibilityManager.show();
        }
    }

    toggleKeyboard() {
        if (this._keyboardCore && this._isEnabled && this._keyboardCore.toggle) {
            this._keyboardCore.toggle();
        }
    }

    getKeyboardCore() {
        return this._keyboardCore;
    }

    getInputHandler() {
        return this._inputHandler;
    }

    getTextEngine() {
        return this._textEngine;
    }

    _safeInit(initFn, name) {
        try {
            initFn();
        } catch (error) {
            log(`[betterKeys] Failed to initialize ${name}: ${error}`);
        }
    }

    _onSettingsChanged(settings, key) {
        log(`[betterKeys] Setting changed: ${key}`);
        if (key === 'theme-name' && this._themeManager && this._themeManager.applyCurrentTheme) {
            this._themeManager.applyCurrentTheme();
        }
    }

    _attemptCleanup() {
        try {
            if (this._visibilityManager && this._visibilityManager.disable) {
                this._visibilityManager.disable();
            }
            if (this._animationManager && this._animationManager.stop) {
                this._animationManager.stop();
            }
        } catch (e) {
            logError(`[betterKeys] Error during cleanup: ${e}`);
        }
    }
});
