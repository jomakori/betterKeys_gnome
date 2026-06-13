import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const POSITION_KEYS = ['bottom', 'top', 'left', 'right', 'floating'];

export const WindowManager = GObject.registerClass(
class WindowManager extends GObject.Object {
    _init(keyboardUI, settingsManager) {
        super._init();

        this._keyboardUI = keyboardUI;
        this._settings = settingsManager;
        this._container = null;
        this._visible = false;
        this._position = 'bottom';
        this._animDuration = 180;
        this._heightNotifyId = 0;

        this._container = new St.Widget({
            reactive: false,
            can_focus: false,
            style_class: 'betterkeys-window',
        });
        this._container.add_child(this._keyboardUI);

        this._monitorChangedId = Main.layoutManager.connect(
            'monitors-changed', () => this._updatePosition()
        );

        /* reposition once keyboardUI actually gets its height allocated */
        this._heightNotifyId = this._keyboardUI.connect('notify::height', () => {
            if (this._container?.get_stage()) this._updatePosition();
        });

        this._position = this._settings.getDockingPosition();
    }

    /* ---- visibility ---- */

    show() {
        if (this._visible) return;

        Main.uiGroup.add_child(this._container);
        /* initial position uses keyboard-height setting as fallback
           because keyboardUI.height may still be 0 before allocation */
        this._updatePosition();
        this._container.opacity = 0;
        this._container.ease({
            opacity: 255,
            duration: this._animDuration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => { this._visible = true; },
        });
    }

    hide() {
        if (!this._visible) return;

        this._container.ease({
            opacity: 0,
            duration: this._animDuration,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                Main.uiGroup.remove_child(this._container);
                this._visible = false;
            },
        });
    }

    toggle() {
        if (this._visible) this.hide();
        else this.show();
    }

    get isVisible() { return this._visible; }

    /* ---- positioning ---- */

    setDockingPosition(pos) {
        this._position = pos;
        if (this._visible) this._updatePosition();
    }

    _updatePosition() {
        if (!this._container) return;

        const monitor = global.display.get_primary_monitor();
        const geo = global.display.get_monitor_geometry(monitor);
        const pad = 12;
        /* use actual keyboardUI height once allocated; fall back to
           the keyboard-height setting so initial position is correct */
        const kbHeight = this._keyboardUI.height > 0
            ? this._keyboardUI.height
            : this._settings.getKeyboardHeight();

        switch (this._position) {
            case 'top':
                this._container.x = geo.x + pad;
                this._container.y = geo.y + pad;
                this._container.width = geo.width - pad * 2;
                break;
            case 'bottom':
            default:
                this._container.x = geo.x + pad;
                this._container.y = geo.y + geo.height - kbHeight - pad;
                this._container.width = geo.width - pad * 2;
                break;
        }
    }

    /* ---- lifecycle ---- */

    destroy() {
        if (this._visible) {
            Main.uiGroup.remove_child(this._container);
            this._visible = false;
        }
        if (this._monitorChangedId) {
            Main.layoutManager.disconnect(this._monitorChangedId);
            this._monitorChangedId = 0;
        }
        if (this._heightNotifyId) {
            this._keyboardUI.disconnect(this._heightNotifyId);
            this._heightNotifyId = 0;
        }
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
        this._keyboardUI = null;
        this._settings = null;
    }
});
