/* src/keyboard-ui.js — Virtual keyboard widget built from layout definitions */

import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

const SPECIAL_KEYS = new Set([
    'Enter', 'Backspace', 'Shift', 'Tab', 'Caps', 'Esc',
    'Ctrl', 'Alt', 'Super', '?123', 'ABC', 'Space',
]);

const WIDE_KEYS = new Set(['Space']);

/**
 * Map a key label to its style-class suffix.
 */
function styleSuffix(label) {
    if (label === 'Space') return 'space';
    if (label === 'Enter') return 'enter';
    if (label === 'Backspace' || label === 'Delete') return 'backspace';
    if (label === 'Shift') return 'shift';
    if (label === '?123' || label === 'ABC') return 'symbol';
    return '';
}

export const KeyboardUI = GObject.registerClass({
    Signals: {
        'key-activated': {param_types: [GObject.TYPE_STRING]},
    },
}, class KeyboardUI extends St.Widget {
    _init(layout, settingsManager) {
        super._init({
            reactive: true,
            can_focus: true,
            style_class: 'betterkeys-keyboard',
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                spacing: 4,
            }),
        });

        this._settings = settingsManager;
        this._layout = layout;
        this._shiftOn = false;
        this._symbolMode = false;
        this._rows = [];

        this._buildFromLayout(layout);
    }

    /* ---- rebuild entire keyboard from a layout object ---- */

    setLayout(layout) {
        this._layout = layout;
        this._destroyRows();
        this._buildFromLayout(layout);
    }

    _destroyRows() {
        for (const row of this._rows) {
            this.remove_child(row);
        }
        this._rows = [];
    }

    _buildFromLayout(layout) {
        if (!layout || !layout.rows) return;

        const keyW = layout.keyWidth ?? 60;
        const keyH = layout.keyHeight ?? 60;
        const spacing = layout.spacing ?? 4;

        for (const rowDef of layout.rows) {
            const row = new St.BoxLayout({
                style_class: 'betterkeys-row',
                reactive: false,
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
            });

            for (const keyLabel of rowDef.keys) {
                const btn = this._createKeyButton(keyLabel, keyW, keyH);
                row.add_child(btn);
            }

            this.add_child(row);
            this._rows.push(row);
        }
    }

    _createKeyButton(label, defaultW, defaultH) {
        const w = WIDE_KEYS.has(label) ? defaultW * 3 : defaultW;
        const suffix = styleSuffix(label);

        const btn = new St.Button({
            reactive: true,
            can_focus: true,
            style_class: `betterkeys-key${suffix ? ' betterkeys-key-' + suffix : ''}`,
            width: w,
            height: defaultH,
            label: this._labelForDisplay(label),
            x_expand: false,
        });

        btn.connect('clicked', () => {
            this._handleKeyPress(label);
        });

        btn.connect('touch-event', (actor, event) => {
            if (event.type() === Clutter.EventType.TOUCH_BEGIN) {
                btn.add_style_pseudo_class('active');
            } else if (event.type() === Clutter.EventType.TOUCH_END) {
                btn.remove_style_pseudo_class('active');
            }
            return Clutter.EVENT_PROPAGATE;
        });

        btn.connect('button-press-event', () => {
            btn.add_style_pseudo_class('active');
            return Clutter.EVENT_PROPAGATE;
        });

        btn.connect('button-release-event', () => {
            btn.remove_style_pseudo_class('active');
            return Clutter.EVENT_PROPAGATE;
        });

        return btn;
    }

    _labelForDisplay(label) {
        if (label === 'Space') return ' ';
        if (!this._shiftOn) return label;
        /* Uppercase alpha keys when shift is active */
        if (/^[a-zA-Z]$/.test(label)) return label.toUpperCase();
        return label;
    }

    _handleKeyPress(label) {
        if (label === 'Shift') {
            this._shiftOn = !this._shiftOn;
            this._updateShiftDisplay();
            this.emit('key-activated', label);
            return;
        }

        if (label === '?123') {
            this._symbolMode = !this._symbolMode;
            this.emit('key-activated', label);
            return;
        }

        /* Resolve the actual character to emit */
        let output = label;
        if (label === 'Space') output = ' ';
        else if (this._shiftOn && /^[a-zA-Z]$/.test(label))
            output = label.toUpperCase();
        else if (this._shiftOn && label.length === 1)
            output = label.toUpperCase();

        /* Temporarily release shift after one alpha key (like a real keyboard) */
        const wasShift = this._shiftOn && /^[a-zA-Z]$/.test(label);
        if (wasShift) {
            this._shiftOn = false;
            this._updateShiftDisplay();
        }

        this.emit('key-activated', output);
    }

    _updateShiftDisplay() {
        /* Rebuild the keyboard to reflect shifted labels */
        const layout = this._layout;
        if (!layout) return;

        let i = 0;
        for (const rowDef of layout.rows) {
            const row = this._rows[i];
            if (!row) break;
            const children = row.get_children();
            for (let j = 0; j < children.length; j++) {
                const btn = children[j];
                if (!(btn instanceof St.Button)) continue;
                const label = rowDef.keys[j];
                btn.label = this._labelForDisplay(label);
            }
            i++;
        }
    }
});
