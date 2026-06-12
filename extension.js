import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { KeyboardManager } from './src/main.js';

export default class BetterKeysExtension extends Extension {
    enable() {
        this._signalHandlers = [];
        this._keyboardManager = new KeyboardManager(this);
        this._keyboardManager.enable();

        if (global.workspace_manager) {
            const id = global.workspace_manager.connect('active-workspace-changed', () => {
                if (this._keyboardManager) this._keyboardManager.hideKeyboard();
            });
            this._signalHandlers.push({ object: global.workspace_manager, id });
        }
        if (global.display) {
            const id = global.display.connect('monitors-changed', () => {
                const core = this._keyboardManager && this._keyboardManager.getKeyboardCore();
                if (core && core.updatePosition) core.updatePosition();
            });
            this._signalHandlers.push({ object: global.display, id });
        }
    }

    disable() {
        this._signalHandlers.forEach(({ object, id }) => {
            try { if (object && object.disconnect) object.disconnect(id); } catch (e) {}
        });
        this._signalHandlers = [];

        if (this._keyboardManager) {
            this._keyboardManager.disable();
            this._keyboardManager = null;
        }
    }
}
