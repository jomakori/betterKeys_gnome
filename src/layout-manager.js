/* src/layout-manager.js — Load keyboard layout definitions from data/layouts/ */

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export class LayoutManager {
    constructor(extension) {
        this._extension = extension;
        this._cache = new Map();   /* layoutId → parsed JSON */
        this._dir = null;
    }

    /* --- internal: resolve the data/layouts directory --- */

    _resolveDir() {
        if (this._dir) return this._dir;

        let base;
        if (this._extension && this._extension.dir &&
            typeof this._extension.dir.get_child === 'function') {
            base = this._extension.dir.get_child('data').get_child('layouts');
        } else {
            /* fallback: walk from import.meta.url */
            const f = Gio.File.new_for_uri(import.meta.url);
            base = f.get_parent().get_parent().get_child('data').get_child('layouts');
        }

        if (!base.query_exists(null)) {
            logError(`[betterKeys] layouts dir not found: ${base.get_path()}`);
            return null;
        }
        this._dir = base;
        return base;
    }

    /* --- load a single layout file by name --- */

    _loadFile(fileName) {
        const dir = this._resolveDir();
        if (!dir) return null;

        const file = dir.get_child(fileName);
        if (!file.query_exists(null)) return null;

        try {
            const [ok, bytes] = file.load_contents(null);
            if (!ok) return null;
            const json = JSON.parse(new TextDecoder().decode(bytes));
            return json;
        } catch (e) {
            logError(`[betterKeys] failed to load layout ${fileName}: ${e}`);
            return null;
        }
    }

    /* --- public API --- */

    /**
     * Load a layout by its file name (with or without .json suffix).
     * Results are cached.
     */
    loadLayout(layoutId) {
        if (this._cache.has(layoutId))
            return this._cache.get(layoutId);

        const fileName = layoutId.endsWith('.json') ? layoutId : `${layoutId}.json`;
        const data = this._loadFile(fileName);
        this._cache.set(layoutId, data);
        return data;
    }

    /**
     * Enumerate all available layouts.
     * Returns an array of { id, name } objects.
     */
    listLayouts() {
        const dir = this._resolveDir();
        if (!dir) return [];

        const results = [];
        try {
            const enumerator = dir.enumerate_children(
                'standard::*', Gio.FileQueryInfoFlags.NONE, null
            );
            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                const name = info.get_name();
                if (!name.endsWith('.json')) continue;
                const id = name.slice(0, -5);   /* strip .json */
                const data = this.loadLayout(id);
                results.push({
                    id,
                    name: data?.name ?? id,
                });
            }
        } catch (e) {
            logError(`[betterKeys] listLayouts error: ${e}`);
        }
        return results;
    }

    getDefaultLayout() {
        return this.loadLayout('en_US_qwerty');
    }

    /* --- lifecycle --- */

    destroy() {
        this._cache.clear();
        this._extension = null;
        this._dir = null;
    }
}
