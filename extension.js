/* extension.js - Main entry point for BetterKeys Virtual Keyboard */

const { GObject, St, Clutter, Gio, GLib, Shell } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const KeyboardManager = Me.imports.src.main.KeyboardManager;

let keyboardManager = null;
let signalHandlers = [];
let compatibilityChecked = false;

function init() {
    log(`[BetterKeys] Initializing extension ${Me.metadata.uuid}`);
    
    // Check GNOME Shell compatibility
    if (!checkCompatibility()) {
        logError('[BetterKeys] Extension incompatible with this GNOME Shell version');
        return;
    }
    
    compatibilityChecked = true;
}

function enable() {
    log(`[BetterKeys] Enabling extension`);
    
    if (!compatibilityChecked) {
        logError('[BetterKeys] Extension not properly initialized, skipping enable');
        return;
    }
    
    try {
        // Initialize the keyboard manager
        keyboardManager = new KeyboardManager();
        keyboardManager.enable();
        
        // Connect to Shell signals
        connectShellSignals();
        
        log(`[BetterKeys] Extension enabled successfully`);
    } catch (error) {
        logError(`[BetterKeys] Failed to enable extension: ${error}`);
        logError(error.stack);
        // Attempt cleanup
        cleanup();
    }
}

function disable() {
    log(`[BetterKeys] Disabling extension`);
    
    try {
        // Disconnect all signal handlers
        disconnectShellSignals();
        
        if (keyboardManager) {
            keyboardManager.disable();
            keyboardManager = null;
        }
        
        log(`[BetterKeys] Extension disabled successfully`);
    } catch (error) {
        logError(`[BetterKeys] Failed to disable extension: ${error}`);
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
    
    log(`[BetterKeys] GNOME Shell version: ${shellVersion}`);
    
    // Simple numeric comparison (major version)
    const majorVersion = parseInt(shellVersion.split('.')[0]);
    if (majorVersion < parseInt(minVersion) || majorVersion > parseInt(maxVersion)) {
        logError(`[BetterKeys] Unsupported GNOME Shell version ${shellVersion}. Requires ${minVersion}.x-${maxVersion}.x`);
        return false;
    }
    
    // Check for required APIs
    if (!imports.ui.main || !imports.ui.main.uiGroup) {
        logError('[BetterKeys] Required UI APIs not available');
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
            log(`[BetterKeys] Session mode changed: ${mode}`);
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
            log('[BetterKeys] Active workspace changed');
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
            log('[BetterKeys] Monitor configuration changed');
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
        log('[BetterKeys] System theme changed');
        // Potentially adjust keyboard theme
        if (keyboardManager) {
            keyboardManager.getKeyboardCore()?.refreshTheme();
        }
    });
    signalHandlers.push({ object: settings, handlerId });
    
    log(`[BetterKeys] Connected ${signalHandlers.length} shell signal handlers`);
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
            logError(`[BetterKeys] Error disconnecting signal: ${error}`);
        }
    });
    signalHandlers = [];
    log('[BetterKeys] Disconnected all shell signal handlers');
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
    log('[BetterKeys] Cleanup completed');
}

// Helper logging functions
function log(message) {
    global.log(`[BetterKeys] ${message}`);
}

function logError(message) {
    global.logError(`[BetterKeys] ${message}`);
}
