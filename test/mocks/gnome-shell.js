/* test/mocks/gnome-shell.js - Mock GNOME Shell environment for testing */

const GObject = {
    registerClass: (cls) => cls,
    TYPE_STRING: 'string',
    TYPE_POINTER: 'pointer',
    TYPE_BOOLEAN: 'boolean',
    TYPE_INT: 'int',
};

const GLib = {
    get_monotonic_time: () => Date.now() * 1000,
    PRIORITY_DEFAULT: 0,
    timeout_add: (priority, interval, callback) => {
        const id = setTimeout(callback, interval);
        return id;
    },
    source_remove: (id) => clearTimeout(id),
    random_int_range: (min, max) => Math.floor(Math.random() * (max - min)) + min,
};

const Gio = {
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
        enumerate_children(attributes, flags) {
            return {
                next_file: () => null,
                close: () => {},
            };
        }
        load_contents() {
            return [true, new Uint8Array()];
        }
        get_path() {
            return this.path;
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
        connect(event, callback) {
            this._listeners.push(callback);
        }
        _notify(key) {
            this._listeners.forEach(cb => cb(this, key));
        }
    },
};

const Clutter = {
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
};

const St = {
    Widget: class {},
    Box: class {},
    Label: class {},
};

const Main = {
    uiGroup: {
        add_actor: () => {},
        remove_actor: () => {},
    },
};

const ExtensionUtils = {
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
};

// Export mocks
module.exports = {
    GObject,
    GLib,
    Gio,
    Clutter,
    St,
    Main,
    ExtensionUtils,
};
