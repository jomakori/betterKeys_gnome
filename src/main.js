const { GObject } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var betterKeysKeyboardManager = GObject.registerClass(
class betterKeysKeyboardManager extends GObject.Object {
    _init() {
        super._init();
        this._isEnabled = false;
        log('[betterKeys] KeyboardManager initialized');
    }

    enable() {
        if (this._isEnabled) return;
        this._isEnabled = true;
        log('[betterKeys] KeyboardManager enabled - keyboard ready');
    }

    disable() {
        if (!this._isEnabled) return;
        this._isEnabled = false;
        log('[betterKeys] KeyboardManager disabled');
    }

    hideKeyboard() {
        log('[betterKeys] hideKeyboard called');
    }

    showKeyboard() {
        log('[betterKeys] showKeyboard called');
    }

    toggleKeyboard() {
        log('[betterKeys] toggleKeyboard called');
    }

    getKeyboardCore() {
        return null;
    }
});

var KeyboardManager = betterKeysKeyboardManager;
