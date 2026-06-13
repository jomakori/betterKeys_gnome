import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {KeyboardManager} from './src/main.js';

export default class BetterKeysExtension extends Extension {
    enable() {
        this._manager = new KeyboardManager(this);
        this._manager.enable();
    }

    disable() {
        this._manager?.disable();
        this._manager = null;
    }
}
