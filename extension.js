/* extension.js - Main entry point for betterKeys Virtual Keyboard */

// Extension entry point - no direct imports needed
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const KeyboardManager = Me.imports.src.main.KeyboardManager;

let keyboardManager = null;
let signalHandlers = [];
let compatibilityChecked = false;

function init() {
    log(`[betterKeys] Initializing extension ${Me.metadata.uuid}`);

    // Check GNOME Shell compatibility
    if (!checkCompatibility()) {
        logError('[betterKeys] Extension incompatible with this GNOME Shell version');
        return;
    }

    compatibilityChecked = true;
}

function enable() {
    log('[betterKeys] Enabling extension');

    if (!compatibilityChecked) {
        logError('[betterKeys] Extension not properly initialized, skipping enable');
        return;
    }

    try {
        // Initialize the keyboard manager
        keyboardManager = new KeyboardManager();
        keyboardManager.enable();

        // Connect to Shell signals
        connectShellSignals();

        log('[betterKeys] Extension enabled successfully');
    } catch (error) {
        logError(`[betterKeys] Failed to enable extension: ${error}`);
        logError(error.stack);
        // Attempt cleanup
        cleanup();
    }
}

function disable() {
    log('[betterKeys] Disabling extension');

    try {
        // Disconnect all signal handlers
        disconnectShellSignals();

        if (keyboardManager) {
            keyboardManager.disable();
            keyboardManager = null;
        }

        log('[betterKeys] Extension disabled successfully');
    } catch (error) {
        logError(`[betterKeys] Failed to disable extension: ${error}`);
        logError(error.stack);
    } finally {
        cleanup();
    }
}

/**
 * Check GNOME Shell version compatibility.
 * @returns {boolean} True if compatible, false otherwise.
 */
function checkCompatibility() {
    const shellVersion = imports.misc.config.PACKAGE_VERSION;
    const minVersion = '40'; // Minimum supported GNOME Shell version
    const maxVersion = '50'; // Maximum supported version (adjust as needed)

    log(`[betterKeys] GNOME Shell version: ${shellVersion}`);

    // Simple numeric comparison (major version)
    const majorVersion = parseInt(shellVersion.split('.')[0]);
    if (majorVersion < parseInt(minVersion) || majorVersion > parseInt(maxVersion)) {
        logError(`[betterKeys] Unsupported GNOME Shell version ${shellVersion}. Requires ${minVersion}.x-${maxVersion}.x`);
        return false;
    }

    // Check for required APIs
    if (!imports.ui.main || !imports.ui.main.uiGroup) {
        logError('[betterKeys] Required UI APIs not available');
        return false;
    }

    return true;
}

/**
 * Connect to relevant Shell signals for lifecycle and session events.
 */
function connectShellSignals() {
    const display = global.display;
    const sessionMode = Shell.SessionMode.get_current();

    // Track session mode changes
    if (sessionMode) {
        const handlerId = sessionMode.connect('session-mode-changed', (mode) => {
            log(`[betterKeys] Session mode changed: ${mode}`);
            // Re-evaluate keyboard visibility based on new mode
            if (keyboardManager) {
                keyboardManager.hideKeyboard();
            }
        });
        signalHandlers.push({ object: sessionMode, handlerId });
    }

    // Track workspace switched
    const workspaceManager = global.workspace_manager;
    if (workspaceManager) {
        const handlerId = workspaceManager.connect('active-workspace-changed', () => {
            log('[betterKeys] Active workspace changed');
            // Hide keyboard when switching workspaces
            if (keyboardManager) {
                keyboardManager.hideKeyboard();
            }
        });
        signalHandlers.push({ object: workspaceManager, handlerId });
    }

    // Track screen size changes
    if (display) {
        const handlerId = display.connect('monitors-changed', () => {
            log('[betterKeys] Monitor configuration changed');
            // Update keyboard positioning
            if (keyboardManager) {
                keyboardManager.getKeyboardCore()?.updatePosition();
            }
        });
        signalHandlers.push({ object: display, handlerId });
    }

    // Track system theme changes
    const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
    const handlerId = settings.connect('changed::gtk-theme', () => {
        log('[betterKeys] System theme changed');
        // Potentially adjust keyboard theme
        if (keyboardManager) {
            keyboardManager.getKeyboardCore()?.refreshTheme();
        }
    });
    signalHandlers.push({ object: settings, handlerId });

    log(`[betterKeys] Connected ${signalHandlers.length} shell signal handlers`);
}

/**
 * Disconnect all registered signal handlers.
 */
function disconnectShellSignals() {
    signalHandlers.forEach(({ object, handlerId }) => {
        try {
            if (object && typeof object.disconnect === 'function') {
                object.disconnect(handlerId);
            }
        } catch (error) {
            logError(`[betterKeys] Error disconnecting signal: ${error}`);
        }
    });
    signalHandlers = [];
    log('[betterKeys] Disconnected all shell signal handlers');
}

/**
 * Clean up any remaining resources.
 */
function cleanup() {
    // Ensure keyboard manager is null
    if (keyboardManager) {
        keyboardManager.disable();
        keyboardManager = null;
    }

    // Clear signal handlers
    disconnectShellSignals();

    compatibilityChecked = false;
    log('[betterKeys] Cleanup completed');
}

// Helper logging functions
function log(message) {
    global.log(`[betterKeys] ${message}`);
}

function logError(message) {
    global.logError(`[betterKeys] ${message}`);
}
