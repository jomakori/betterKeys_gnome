/* src/input-controller.js — IBus text commit for virtual keyboard output */

import IBus from 'gi://IBus';
import GLib from 'gi://GLib';

export class InputController {
    constructor() {
        this._bus = null;
        this._engine = null;
        this._ready = false;
    }

    enable() {
        try {
            this._bus = new IBus.Bus();
            this._bus.connect('connected', () => {
                this._bus.get_engine((engine) => {
                    this._engine = engine;
                    this._ready = true;
                });
            });
            this._bus.connect('disconnected', () => {
                this._ready = false;
                this._engine = null;
            });
            if (!this._bus.is_connected())
                this._bus.connect_sync();
        } catch (e) {
            logError(`[betterKeys] IBus init failed: ${e}`);
        }
    }

    disable() {
        this._ready = false;
        this._engine = null;
        this._bus = null;
    }

    /**
     * Commit a single character or string via the IBus engine.
     * Handles special-key semantics for Enter, Backspace, Tab.
     */
    commit(keyLabel) {
        if (!this._ready || !this._engine) {
            /* Fallback: try direct commit even without engine */
            return;
        }

        switch (keyLabel) {
            case 'Enter':
                this._commitText('\n');
                break;
            case 'Backspace':
            case 'Delete':
                this._forwardKeyEvent(IBus.BACKSPACE, IBus.KEY_RELEASE);
                break;
            case 'Tab':
                this._commitText('\t');
                break;
            case 'Space':
                this._commitText(' ');
                break;
            default:
                if (keyLabel.length === 1)
                    this._commitText(keyLabel);
                break;
        }
    }

    _commitText(text) {
        try {
            this._engine.commit_text(text);
        } catch (e) {
            logError(`[betterKeys] commit_text failed: ${e}`);
        }
    }

    _forwardKeyEvent(keyval, keycode, state) {
        try {
            const ev = new IBus.Event({
                keyval,
                keycode: keycode ?? 0,
                state: state ?? 0,
                time: GLib.get_monotonic_time() / 1000,
            });
            this._engine.forward_key_event(ev);
        } catch (e) {
            logError(`[betterKeys] forward_key_event failed: ${e}`);
        }
    }
}
