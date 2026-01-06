/* src/main.js - Main orchestration module for BetterKeys */

const { GObject, St, Clutter, Gio } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const KeyboardUI = Me.imports.src.ui.keyboard.KeyboardUI;
const SettingsManager = Me.imports.src.settings.manager.SettingsManager;
const KeyboardCoreManager = Me.imports.src.keyboard.manager.KeyboardManager;
const InputEventHandler = Me.imports.src.input.handler.InputEventHandler;
const LayoutManager = Me.imports.src.keyboard['layout-manager'].LayoutManager;
const TextEngine = Me.imports.src.input['text-engine'].TextEngine;
const KeyPressHandler = Me.imports.src.input['key-press'].KeyPressHandler;
const GestureRecognizer = Me.imports.src.input['gesture-recognizer'].GestureRecognizer;
const InputValidator = Me.imports.src.input.validator.InputValidator;
const EventEmitter = Me.imports.src.utils['event-emitter'].EventEmitter;

// New UI managers
const WindowManager = Me.imports.src.ui['window-manager'].WindowManager;
const VisibilityManager = Me.imports.src.ui['visibility-manager'].VisibilityManager;
const AnimationManager = Me.imports.src.ui.animations.AnimationManager;
const AccessibilityManager = Me.imports.src.ui.accessibility.AccessibilityManager;
const InputMethodBridge = Me.imports.src.ui['input-method-bridge'].InputMethodBridge;

const BetterKeysKeyboardManager = GObject.registerClass(
class BetterKeysKeyboardManager extends GObject.Object {
    _init() {
        super._init();
        
        this._settings = new SettingsManager();
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
        
        // New UI managers
        this._windowManager = null;
        this._visibilityManager = null;
        this._animationManager = null;
        this._accessibilityManager = null;
        this._inputMethodBridge = null;
        
        log('[BetterKeys] KeyboardManager initialized');
    }
    
    enable() {
        if (this._isEnabled) {
            return;
        }
        
        log('[BetterKeys] Enabling keyboard manager');
        
        try {
            // Create core components
            this._eventEmitter = new EventEmitter();
            this._layoutManager = new LayoutManager();
            this._textEngine = new TextEngine(this._settings);
            this._keyPressHandler = new KeyPressHandler(this._settings);
            this._gestureRecognizer = new GestureRecognizer(this._settings);
            this._inputValidator = new InputValidator(this._settings);
            
            // Create the keyboard UI
            this._keyboardUI = new KeyboardUI(this._settings);
            
            // Create UI managers
            this._windowManager = new WindowManager(this._settings);
            this._windowManager.setKeyboardUI(this._keyboardUI);
            this._keyboardUI.setWindowManager(this._windowManager);
            
            this._animationManager = new AnimationManager();
            this._animationManager.start();
            
            this._accessibilityManager = new AccessibilityManager(this._settings);
            this._accessibilityManager.setKeyboardUI(this._keyboardUI);
            
            this._inputMethodBridge = new InputMethodBridge(this._settings);
            this._inputMethodBridge.setKeyboardUI(this._keyboardUI);
            
            this._visibilityManager = new VisibilityManager(this._settings, this._windowManager);
            this._visibilityManager.setKeyboardUI(this._keyboardUI);
            this._visibilityManager.enable();
            
            // Create input event handler
            this._inputHandler = new InputEventHandler(this._keyboardUI, this._settings);
            this._inputHandler.setGestureRecognizer(this._gestureRecognizer);
            
            // Create keyboard core manager
            this._keyboardCore = new KeyboardCoreManager(this._settings);
            this._keyboardCore.enable(
                this._keyboardUI,
                this._inputHandler,
                this._layoutManager,
                this._textEngine,
                this._keyPressHandler
            );
            
            // Connect to settings changes
            this._settings.connect('changed', this._onSettingsChanged.bind(this));
            
            // Start input handling
            this._inputHandler.start();
            
            this._isEnabled = true;
            log('[BetterKeys] Keyboard manager enabled successfully');
        } catch (error) {
            logError(`[BetterKeys] Failed to enable keyboard manager: ${error}`);
            logError(error.stack);
        }
    }
    
    disable() {
        if (!this._isEnabled) {
            return;
        }
        
        log('[BetterKeys] Disabling keyboard manager');
        
        try {
            // Disable visibility manager first (removes hotkey, focus tracking)
            if (this._visibilityManager) {
                this._visibilityManager.disable();
                this._visibilityManager = null;
            }
            
            // Destroy UI managers
            if (this._windowManager) {
                this._windowManager.destroy();
                this._windowManager = null;
            }
            
            if (this._animationManager) {
                this._animationManager.destroy();
                this._animationManager = null;
            }
            
            if (this._accessibilityManager) {
                this._accessibilityManager.destroy();
                this._accessibilityManager = null;
            }
            
            if (this._inputMethodBridge) {
                this._inputMethodBridge.destroy();
                this._inputMethodBridge = null;
            }
            
            // Disable core components
            if (this._keyboardCore) {
                this._keyboardCore.disable();
                this._keyboardCore = null;
            }
            
            if (this._inputHandler) {
                this._inputHandler.stop();
                this._inputHandler = null;
            }
            
            if (this._keyboardUI) {
                this._keyboardUI.destroy();
                this._keyboardUI = null;
            }
            
            // Clean up other components
            this._layoutManager = null;
            this._textEngine = null;
            this._keyPressHandler = null;
            this._gestureRecognizer = null;
            this._inputValidator = null;
            this._eventEmitter = null;
            
            this._isEnabled = false;
            log('[BetterKeys] Keyboard manager disabled successfully');
        } catch (error) {
            logError(`[BetterKeys] Failed to disable keyboard manager: ${error}`);
            logError(error.stack);
        }
    }
    
    _onSettingsChanged(settings, key) {
        log(`[BetterKeys] Setting changed: ${key}`);
        
        if (this._keyboardUI) {
            this._keyboardUI.onSettingsChanged(key);
        }
        
        // Propagate to core manager
        if (this._keyboardCore) {
            this._keyboardCore._onSettingsChanged(settings, key);
        }
    }
    
    showKeyboard() {
        if (this._keyboardCore && this._isEnabled) {
            this._keyboardCore.show();
        }
    }
    
    hideKeyboard() {
        if (this._keyboardCore && this._isEnabled) {
            this._keyboardCore.hide();
        }
    }
    
    toggleKeyboard() {
        if (this._keyboardCore && this._isEnabled) {
            this._keyboardCore.toggle();
        }
    }
    
    // Additional methods for external control
    getKeyboardCore() {
        return this._keyboardCore;
    }
    
    getInputHandler() {
        return this._inputHandler;
    }
    
    getTextEngine() {
        return this._textEngine;
    }
});

// Export the KeyboardManager class
var KeyboardManager = BetterKeysKeyboardManager;
