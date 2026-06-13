import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import {SettingsManager} from './settings.js';
import {LayoutManager} from './layout-manager.js';
import {KeyboardUI} from './keyboard-ui.js';
import {WindowManager} from './window-manager.js';
import {InputController} from './input-controller.js';

export const KeyboardManager = GObject.registerClass(
class KeyboardManager extends GObject.Object {
    _init(extension) {
        super._init();
        this._extension = extension;
        this._settings = null;
        this._layouts = null;
        this._keyboardUI = null;
        this._window = null;
        this._input = null;
    }

    enable() {
        this._settings = new SettingsManager(this._extension);

        this._layouts = new LayoutManager(this._extension);
        const layout = this._layouts.loadLayout(this._settings.getCurrentLayout())
            ?? this._layouts.getDefaultLayout();

        this._keyboardUI = new KeyboardUI(layout, this._settings);
        this._window = new WindowManager(this._keyboardUI, this._settings);
        this._input = new InputController();
        this._input.enable();

        this._keyboardUI.connect('key-activated', (_ui, key) => {
            this._onKey(key);
        });

        this._settings.connect('changed', (_s, key) => {
            if (key === 'current-layout')
                this._reloadLayout();
            else if (key === 'docking-position')
                this._window?.setDockingPosition(this._settings.getDockingPosition());
        });

        if (this._settings.getAutoShowEnabled())
            this._window.show();

        this._suppressNativeOsk();
    }

    disable() {
        this._restoreNativeOsk();

        this._input?.disable();
        this._input = null;

        /* window.destroy() cascades to keyboardUI (it's a child of window's container) */
        this._window?.destroy();
        this._window = null;

        this._keyboardUI = null;

        this._layouts?.destroy();
        this._layouts = null;

        this._settings?.disconnectAll();
        this._settings = null;

        this._extension = null;
    }

    /* ---- key dispatch ---- */

    _onKey(label) {
        switch (label) {
            case 'Shift':
            case '?123':
                break;
            default:
                this._input?.commit(label);
                break;
        }
    }

    _reloadLayout() {
        const id = this._settings.getCurrentLayout();
        const layout = this._layouts.loadLayout(id);
        if (layout)
            this._keyboardUI?.setLayout(layout);
    }

    /* ---- public helpers ---- */

    show()   { this._window?.show(); }
    hide()   { this._window?.hide(); }
    toggle() { this._window?.toggle(); }

    /* ---- native OSK suppression ---- */

    _suppressNativeOsk() {
        try {
            this._a11ySettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.a11y.applications',
            });
            this._nativeOskWasEnabled = this._a11ySettings.get_boolean(
                'screen-keyboard-enabled'
            );
            if (this._nativeOskWasEnabled) {
                this._a11ySettings.set_boolean('screen-keyboard-enabled', false);
            }
        } catch (e) {
            this._a11ySettings = null;
        }
    }

    _restoreNativeOsk() {
        if (this._a11ySettings && this._nativeOskWasEnabled) {
            try {
                this._a11ySettings.set_boolean('screen-keyboard-enabled', true);
            } catch (e) {
                /* best effort */
            }
        }
        this._a11ySettings = null;
        this._nativeOskWasEnabled = false;
    }
});
