/* src/input-controller.js — Virtual keyboard input via Clutter virtual device */

import Clutter from 'gi://Clutter';

export class InputController {
    constructor() {
        this._enabled = false;
        this._vdev = null;
    }

    enable() {
        this._enabled = true;
        try {
            const seat = Clutter.get_default_backend().get_default_seat();
            this._vdev = seat.create_virtual_device(
                Clutter.InputDeviceType.KEYBOARD_DEVICE
            );
        } catch (e) {
            logError(e, '[betterKeys] virtual keyboard device unavailable');
            this._vdev = null;
        }
    }

    disable() {
        this._enabled = false;
        this._vdev = null;
    }

    commit(keyLabel) {
        if (!this._enabled || !this._vdev) return;

        let keyval;
        let needsShift = false;

        switch (keyLabel) {
            case 'Enter':     keyval = Clutter.KEY_Return; break;
            case 'Backspace': keyval = Clutter.KEY_BackSpace; break;
            case 'Delete':    keyval = Clutter.KEY_Delete; break;
            case 'Tab':       keyval = Clutter.KEY_Tab; break;
            case 'Space':     keyval = Clutter.KEY_space; break;
            case ' ':         keyval = Clutter.KEY_space; break;
            default:
                if (keyLabel.length !== 1) return;
                keyval = keyLabel.charCodeAt(0);
                if (keyLabel >= 'A' && keyLabel <= 'Z')
                    needsShift = true;
                break;
        }

        this._sendKeyval(keyval, needsShift);
    }

    _sendKeyval(keyval, withShift) {
        try {
            const time = Clutter.get_current_event_time();
            if (withShift) {
                this._vdev.notify_keyval(
                    time, Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED
                );
            }
            this._vdev.notify_keyval(time, keyval, Clutter.KeyState.PRESSED);
            this._vdev.notify_keyval(time, keyval, Clutter.KeyState.RELEASED);
            if (withShift) {
                this._vdev.notify_keyval(
                    time, Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED
                );
            }
        } catch (e) {
            logError(e, '[betterKeys] notify_keyval failed');
        }
    }
}
