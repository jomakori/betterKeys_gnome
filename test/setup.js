/* test/setup.js - Test environment setup for betterKeys unit tests */

// Mock GNOME Shell imports
global.imports = {
    gi: {
        GObject: {
            registerClass: (cls) => {
                // Return a class that can be instantiated
                const RegisteredClass = class extends cls {};
                // Attach some metadata if needed
                RegisteredClass._gtype = 'GObject';
                return RegisteredClass;
            },
            TYPE_STRING: 'string',
            TYPE_POINTER: 'pointer',
            TYPE_BOOLEAN: 'boolean',
            TYPE_INT: 'int',
        },
        GLib: {
            get_monotonic_time: () => Date.now() * 1000,
            PRIORITY_DEFAULT: 0,
            timeout_add: (priority, interval, callback) => {
                // Return a timer ID
                const id = setTimeout(callback, interval);
                return id;
            },
            source_remove: (id) => clearTimeout(id),
            random_int_range: (min, max) => Math.floor(Math.random() * (max - min)) + min,
        },
        Gio: {
            File: class {
                constructor(path) {
                    this.path = path;
                }
                get_child(name) {
                    return new this.constructor(this.path + '/' + name);
                }
                query_exists() {
                    return true;
                }
                enumerate_children() {
                    return {
                        next_file: () => null,
                        close: () => {},
                    };
                }
                load_contents() {
                    return [true, new Uint8Array()];
                }
            },
            FileQueryInfoFlags: {
                NONE: 0,
            },
            Settings: class {
                constructor(schemaId) {
                    this.schemaId = schemaId;
                    this._values = new Map();
                    this._listeners = [];
                }
                get_string(key) {
                    return this._values.get(key) || '';
                }
                set_string(key, value) {
                    this._values.set(key, value);
                    this._notify(key);
                }
                get_boolean(key) {
                    return this._values.get(key) || false;
                }
                set_boolean(key, value) {
                    this._values.set(key, value);
                    this._notify(key);
                }
                get_int(key) {
                    return this._values.get(key) || 0;
                }
                set_int(key, value) {
                    this._values.set(key, value);
                    this._notify(key);
                }
                get_double(key) {
                    return this._values.get(key) || 0.0;
                }
                set_double(key, value) {
                    this._values.set(key, value);
                    this._notify(key);
                }
                get_value(key) {
                    const value = this._values.get(key) || {};
                    return {
                        deep_unpack: () => value
                    };
                }
                set_value(key, value) {
                    this._values.set(key, value);
                    this._notify(key);
                }
                connect(event, callback) {
                    this._listeners.push(callback);
                }
                _notify(key) {
                    this._listeners.forEach(cb => cb(this, key));
                }
            },
        },
        Clutter: {
            Timeline: class {
                constructor({ duration }) {
                    this.duration = duration;
                    this.listeners = {};
                }
                connect(event, callback) {
                    this.listeners[event] = callback;
                }
                start() {
                    if (this.listeners['new-frame']) {
                        this.listeners['new-frame']();
                    }
                }
                stop() {}
            },
            EventType: {
                TOUCH_BEGIN: 0,
                TOUCH_UPDATE: 1,
                TOUCH_END: 2,
                TOUCH_CANCEL: 3,
            },
        },
        Gtk: {
            ScrolledWindow: class {},
            Box: class {},
            Label: class {},
            Switch: class {},
            ComboBoxText: class {},
            Separator: class {},
            Frame: class {},
            PolicyType: {
                NEVER: 0,
                AUTOMATIC: 1,
            },
            Orientation: {
                VERTICAL: 1,
                HORIZONTAL: 0,
            },
            Align: {
                START: 0,
                END: 1,
                FILL: 2,
                CENTER: 3,
            },
        },
    },
    misc: {
        extensionUtils: {
            getCurrentExtension: () => ({
                dir: {
                    get_child: (name) => ({
                        get_child: (child) => ({
                            query_exists: () => true,
                        }),
                    }),
                },
                imports: {},
            }),
            getSettings: (schemaId) => {
                // Return a mock GSettings object
                const settings = new global.imports.gi.Gio.Settings(schemaId);
                return settings;
            },
        },
    },
    ui: {
        main: {
            uiGroup: {
                add_actor: () => {},
                remove_actor: () => {},
            },
        },
    },
};

// Mock global log functions
global.log = (message) => {
    console.log(`[LOG] ${message}`);
};

global.logError = (message) => {
    console.error(`[ERROR] ${message}`);
};

// Mock console for gjs
if (typeof console === 'undefined') {
    global.console = {
        log: global.log,
        error: global.logError,
        warn: global.log,
        info: global.log,
    };
}

// Helper to load a module
global.loadModule = (path) => {
    // In a real test we'd require the file; for now we'll just return a mock
    return require(path);
};

// Export mocks
module.exports = global.imports;
