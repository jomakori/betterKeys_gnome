/**
 * Simple GJS Module Loader for Testing
 *
 * Loads GJS modules by using direct evaluation with Function constructor.
 * This bypasses Node.js vm limitations with class expressions.
 */

const fs = require('fs');
const path = require('path');

/**
 * Load a GJS module and return its namespace
 */
function loadGJSModule(modulePath) {
    const fullPath = path.resolve(__dirname, '../../', modulePath);

    if (!fs.existsSync(fullPath)) {
        throw new Error(`Module not found: ${fullPath}`);
    }

    const code = fs.readFileSync(fullPath, 'utf8');
    const globals = createGJSGlobals();

    try {
        // Use Function constructor to execute code with our globals
        const exports = {};
        const func = new Function(...Object.keys(globals), `
            // Execute module code
            ${code}

            // Capture all var declarations at module scope
            const captured = {};
            for (const key in this) {
                if (key !== 'global' && key !== 'console' && key !== 'exports') {
                    captured[key] = this[key];
                }
            }
            return captured;
        `);

        // Call the function with our globals
        const result = func(...Object.values(globals));

        // Merge result with exports
        Object.assign(exports, result);
        return exports;
    } catch (error) {
        throw new Error(`Failed to load module ${modulePath}: ${error.message}`);
    }
}

/**
 * Create GJS-like globals for testing
 */
function createGJSGlobals() {
    // Base GObject class
    class GObjectBase {
        constructor() {
            if (this._init && typeof this._init === 'function') {
                this._init();
            }
        }
        _init() {}
    }

    // GObject module
    const GObject = {
        registerClass: function(options, cls) {
            // For testing, just return the class
            return cls;
        },
        Object: GObjectBase,
        TYPE_STRING: 'gchararray',
        TYPE_INT: 'gint',
        TYPE_BOOLEAN: 'gboolean',
        TYPE_DOUBLE: 'gdouble',
        TYPE_VARIANT: 'GVariant',
    };

    // GLib module
    const GLib = {
        get_monotonic_time: () => Date.now() * 1000,
        timeout_add: (priority, ms, cb) => setTimeout(cb, ms),
        idle_add: (priority, cb) => setImmediate(cb),
        source_remove: (id) => {
            clearTimeout(id);
            return true;
        },
        Variant: class Variant {
            constructor(typeStr, value) {
                this.typeStr = typeStr;
                this.value = value;
            }
            deep_unpack() {
                return this.value;
            }
        },
    };

    // Gio.Settings class
    class GioSettings {
        constructor(schemaId) {
            this.schemaId = schemaId;
            this._data = new Map();
            this._initDefaults();
        }

        _initDefaults() {
            this._data.set('show-prediction-bar', true);
            this._data.set('auto-correction-enabled', true);
            this._data.set('haptic-feedback-enabled', true);
            this._data.set('key-press-sound-enabled', true);
            this._data.set('current-layout', 'en_US');
            this._data.set('theme-name', 'default');
            this._data.set('application-layouts', {});
        }

        get_boolean(key) {
            return this._data.get(key) || false;
        }

        set_boolean(key, value) {
            this._data.set(key, value);
        }

        get_string(key) {
            return this._data.get(key) || '';
        }

        set_string(key, value) {
            this._data.set(key, value);
        }

        get_int(key) {
            return this._data.get(key) || 0;
        }

        set_int(key, value) {
            this._data.set(key, value);
        }

        get_value(key) {
            const val = this._data.get(key);
            return new GLib.Variant('v', val);
        }

        set_value(key, variant) {
            if (variant && typeof variant.deep_unpack === 'function') {
                this._data.set(key, variant.deep_unpack());
            } else {
                this._data.set(key, variant);
            }
        }

        connect(signal, handler) {
            return 0;
        }
    }

    const Gio = {
        Settings: GioSettings,
    };

    // Imports structure
    const imports = {
        gi: {
            GObject,
            GLib,
            Gio,
            St: { Widget: class {} },
            Clutter: { BoxLayout: class {} },
        },
        misc: {
            extensionUtils: {
                getCurrentExtension: () => ({ dir: {}, imports: {} }),
                getSettings: (schemaId) => new Gio.Settings(schemaId),
            },
            config: { PACKAGE_VERSION: '49.0' },
        },
        ui: {
            main: { uiGroup: {} },
        },
    };

    return {
        // Logging
        log: console.log,
        logError: console.error,
        printerr: console.error,

        // GJS modules
        GObject,
        GLib,
        Gio,
        imports,

        // Standard globals
        console,
        global: {},

        // JavaScript built-ins
        Map,
        Set,
        Symbol,
        Promise,
        Error,
        TypeError,
        RangeError,
        JSON,
        Math,
        Array,
        String,
        Number,
        Boolean,
        Object,
        RegExp,
        Date,
        setTimeout,
        setInterval,
        setImmediate,
        clearTimeout,
        clearInterval,
        clearImmediate,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURI,
        encodeURIComponent,
        decodeURI,
        decodeURIComponent,
    };
}

module.exports = {
    loadGJSModule,
};
