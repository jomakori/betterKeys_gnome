/* src/settings.js — GSettings wrapper with safe fallbacks */

import Gio from 'gi://Gio';

const SCHEMA_ID = 'org.gnome.shell.extensions.betterkeys';

export class SettingsManager {
    constructor(extension) {
        this._settings = extension.getSettings(SCHEMA_ID);
        this._signals = [];
    }

    /* ---- generic safe getters ---- */

    getBoolean(key, fallback = false) {
        try { return this._settings.get_boolean(key); } catch (_) { return fallback; }
    }

    getString(key, fallback = '') {
        try { return this._settings.get_string(key); } catch (_) { return fallback; }
    }

    getInt(key, fallback = 0) {
        try { return this._settings.get_int(key); } catch (_) { return fallback; }
    }

    getDouble(key, fallback = 0.0) {
        try { return this._settings.get_double(key); } catch (_) { return fallback; }
    }

    /* ---- generic safe setters ---- */

    setBoolean(key, value) {
        try { return this._settings.set_boolean(key, value); } catch (_) { return false; }
    }

    setString(key, value) {
        try { return this._settings.set_string(key, value); } catch (_) { return false; }
    }

    setInt(key, value) {
        try { return this._settings.set_int(key, value); } catch (_) { return false; }
    }

    setDouble(key, value) {
        try { return this._settings.set_double(key, value); } catch (_) { return false; }
    }

    /* ---- convenience accessors (cached in schema) ---- */

    getKeyboardHeight()   { return this.getInt('keyboard-height', 300); }
    getKeyboardOpacity()  { return this.getDouble('keyboard-opacity', 0.95); }
    getDockingPosition()  { return this.getString('docking-position', 'bottom'); }
    getCurrentLayout()    { return this.getString('current-layout', 'en_US_qwerty'); }
    getAutoShowEnabled()  { return this.getBoolean('auto-show-enabled', true); }
    getAutoHideEnabled()  { return this.getBoolean('auto-hide-enabled', true); }

    /* ---- signal helpers ---- */

    connect(key, callback) {
        const id = this._settings.connect(key, callback);
        this._signals.push(id);
        return id;
    }

    disconnectAll() {
        for (const id of this._signals)
            this._settings.disconnect(id);
        this._signals = [];
    }

    /* ---- lifecycle ---- */

    destroy() {
        this.disconnectAll();
        this._settings = null;
    }
}
