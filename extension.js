function init() {
    log('[betterKeys] initializing');
}

function enable() {
    try {
        log('[betterKeys] enabling');

        // IMPORTANT: ExtensionUtils and Me must be loaded INSIDE the function,
        // not at module level, to avoid ES6 module syntax errors in GNOME Shell
        const ExtensionUtils = imports.misc.extensionUtils;
        const Me = ExtensionUtils.getCurrentExtension();

        const KeyboardManager = Me.imports.src.main.KeyboardManager;
        const keyboardManager = new KeyboardManager();
        keyboardManager.enable();

        log('[betterKeys] enabled successfully');
    } catch (error) {
        logError('[betterKeys] enable error: ' + error);
    }
}

function disable() {
    try {
        log('[betterKeys] disabling');
    } catch (error) {
        logError('[betterKeys] disable error: ' + error);
    }
}
