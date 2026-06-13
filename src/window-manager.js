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
        this._hideBtn = null;
        this._swipeHandle = null;
        this._visible = false;
        this._position = 'bottom';
        this._animDuration = 200;
        this._heightNotifyId = 0;
        this._monitorChangedId = 0;
        this._monitorChangedId2 = 0;
        this._focusInId = 0;
        this._focusOutId = 0;
        this._captureId = 0;

        this._headerBar = new St.BoxLayout({
            style_class: 'betterkeys-header',
            x_expand: true,
            reactive: false,
            x_align: Clutter.ActorAlign.FILL,
        });

        const spacer = new St.Widget({ x_expand: true, reactive: false });
        this._headerBar.add_child(spacer);

        this._hideBtn = new St.Button({
            reactive: true,
            can_focus: true,
            style_class: 'betterkeys-hide-btn',
            label: '\u2304',
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._hideBtn.connect('button-release-event', () => {
            this.hide();
            return Clutter.EVENT_PROPAGATE;
        });
        this._hideBtn.connect('touch-event', (actor, event) => {
            const type = event.type();
            if (type === 103 || type === Clutter.EventType?.TOUCH_END)
                this.hide();
            return Clutter.EVENT_PROPAGATE;
        });
        this._headerBar.add_child(this._hideBtn);

        this._container = new St.Widget({
            reactive: false,
            can_focus: false,
            style_class: 'betterkeys-window',
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
            }),
        });
        this._container.add_child(this._headerBar);
        this._container.add_child(this._keyboardUI);

        this._monitorChangedId = Main.layoutManager.connect(
            'monitors-changed', () => this._updatePosition()
        );

        this._heightNotifyId = this._keyboardUI.connect('notify::height', () => {
            if (this._container?.get_stage()) {
                this._updatePosition();
            }
        });

        this._setupFocusTracking();
        this._setupKeyCapture();
        this._setupSwipeHandle();

        this._position = this._settings.getDockingPosition();
    }

    /* ---- visibility ---- */

    show() {
        if (this._visible) return;

        Main.uiGroup.add_child(this._container);
        this._updatePosition();

        if (this._swipeHandle)
            this._swipeHandle.visible = false;

        const onScreenY = this._container.y;
        const kbHeight = this._keyboardUI.height > 0
            ? this._keyboardUI.height
            : this._settings.getKeyboardHeight();
        const headerHeight = this._headerBar ? this._headerBar.height : 0;
        const totalHeight = kbHeight + headerHeight;

        this._setKeyboardArea(onScreenY, totalHeight);

        this._container.y = onScreenY + totalHeight;
        this._container.opacity = 255;
        this._container.ease({
            y: onScreenY,
            duration: this._animDuration,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => { this._visible = true; },
        });
    }

    hide() {
        if (!this._container || !this._container.get_parent()) return;

        this._visible = false;
        this._clearKeyboardArea();

        if (this._swipeHandle)
            this._swipeHandle.visible = true;

        const kbHeight = this._keyboardUI.height > 0
            ? this._keyboardUI.height
            : this._settings.getKeyboardHeight();
        const headerHeight = this._headerBar ? this._headerBar.height : 0;
        const totalHeight = kbHeight + headerHeight;
        const offScreenY = this._container.y + totalHeight;

        this._container.ease({
            y: offScreenY,
            duration: this._animDuration,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                if (this._container?.get_parent())
                    Main.uiGroup.remove_child(this._container);
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
        const kbHeight = this._keyboardUI.height > 0
            ? this._keyboardUI.height
            : this._settings.getKeyboardHeight();
        const headerHeight = this._headerBar ? this._headerBar.height : 0;
        const totalHeight = kbHeight + headerHeight;

        switch (this._position) {
            case 'top':
                this._container.x = geo.x + 12;
                this._container.y = geo.y + 12;
                this._container.width = geo.width - 24;
                break;
            case 'bottom':
            default: {
                this._container.x = geo.x;
                this._container.y = geo.y + geo.height - totalHeight;
                this._container.width = geo.width;
                break;
            }
        }
        this._keyboardUI.width = this._container.width;
    }

    /* ---- lifecycle ---- */

    _setupFocusTracking() {
        if (!Main.inputMethod) return;

        try {
            this._focusOutId = Main.inputMethod.connect('focus-out', () => {
                if (this._settings.getAutoHideEnabled() && this._visible)
                    this.hide();
            });
        } catch (e) {
            /* inputMethod signals not available — keyboard stays manual */
        }
    }

    _setupKeyCapture() {
        if (!global.stage) return;

        this._captureId = global.stage.connect(
            'captured-event',
            (actor, event) => {
                const type = event.type();

                if (type === 4 || type === Clutter.EventType?.KEY_PRESS) {
                    if (!this._visible)
                        return Clutter.EVENT_PROPAGATE;
                    const device = event.get_source_device?.();
                    if (device && typeof device.get_device_node === 'function'
                        && !device.get_device_node()) {
                        return Clutter.EVENT_PROPAGATE;
                    }
                    this.hide();
                    return Clutter.EVENT_PROPAGATE;
                }

                if ((type === 2 || type === Clutter.EventType?.BUTTON_PRESS
                     || type === 103 || type === Clutter.EventType?.TOUCH_END)
                    && this._visible) {
                    let [sx, sy] = [0, 0];
                    try { [sx, sy] = event.get_coords(); } catch (_) {}
                    if (this._isOutsideKeyboard(sx, sy))
                        this.hide();
                }

                return Clutter.EVENT_PROPAGATE;
            }
        );
    }

    _isOutsideKeyboard(stageX, stageY) {
        if (!this._container) return false;
        const kbHeight = this._keyboardUI.height > 0
            ? this._keyboardUI.height
            : this._settings.getKeyboardHeight();
        const headerH = this._headerBar?.height ?? 0;
        return stageX < this._container.x
            || stageX > this._container.x + this._container.width
            || stageY < this._container.y
            || stageY > this._container.y + kbHeight + headerH;
    }

    _setKeyboardArea(onScreenY, totalHeight) {
        try {
            global.backend.set_keyboard_area(
                this._container.x,
                onScreenY,
                this._container.width,
                totalHeight
            );
        } catch (e) {
            /* API unavailable — keyboard overlays windows instead */
        }
    }

    _clearKeyboardArea() {
        try {
            global.backend.set_keyboard_area(0, 0, 0, 0);
        } catch (e) {
            /* ignore */
        }
    }

    _setupSwipeHandle() {
        const monitor = global.display.get_primary_monitor();
        const geo = global.display.get_monitor_geometry(monitor);

        this._swipeHandle = new St.Widget({
            reactive: true,
            style_class: 'betterkeys-swipe-handle',
            width: 48,
            height: 8,
            x: geo.x + Math.floor((geo.width - 48) / 2),
            y: geo.y + geo.height - 12,
        });

        this._monitorChangedId2 = Main.layoutManager.connect(
            'monitors-changed', () => {
                const m = global.display.get_primary_monitor();
                const g = global.display.get_monitor_geometry(m);
                this._swipeHandle.x = g.x + Math.floor((g.width - 48) / 2);
                this._swipeHandle.y = g.y + g.height - 12;
            }
        );

        this._swipeHandle.connect('button-release-event', () => {
            this.show();
            return Clutter.EVENT_PROPAGATE;
        });
        this._swipeHandle.connect('touch-event', (actor, event) => {
            if (event.type() === Clutter.EventType.TOUCH_END)
                this.show();
            return Clutter.EVENT_PROPAGATE;
        });

        Main.uiGroup.add_child(this._swipeHandle);
    }

    destroy() {
        this._clearKeyboardArea();
        if (this._visible) {
            Main.uiGroup.remove_child(this._container);
            this._visible = false;
        }
        if (this._monitorChangedId) {
            Main.layoutManager.disconnect(this._monitorChangedId);
            this._monitorChangedId = 0;
        }
        if (this._monitorChangedId2) {
            Main.layoutManager.disconnect(this._monitorChangedId2);
            this._monitorChangedId2 = 0;
        }
        if (this._heightNotifyId) {
            this._keyboardUI.disconnect(this._heightNotifyId);
            this._heightNotifyId = 0;
        }
        if (this._focusInId) {
            Main.inputMethod.disconnect(this._focusInId);
            this._focusInId = 0;
        }
        if (this._focusOutId) {
            Main.inputMethod.disconnect(this._focusOutId);
            this._focusOutId = 0;
        }
        if (this._captureId) {
            global.stage.disconnect(this._captureId);
            this._captureId = 0;
        }
        if (this._swipeHandle) {
            Main.uiGroup.remove_child(this._swipeHandle);
            this._swipeHandle.destroy();
            this._swipeHandle = null;
        }
        if (this._container) {
            this._container.destroy();
            this._container = null;
        }
        this._keyboardUI = null;
        this._hideBtn = null;
        this._headerBar = null;
        this._settings = null;
    }
});
