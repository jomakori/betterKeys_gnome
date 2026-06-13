import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences, gettext as _}
    from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const POSITION_KEYS = ['bottom', 'top', 'left', 'right', 'floating'];

export default class BetterKeysPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'betterKeys',
            icon_name: 'input-keyboard-symbolic',
        });
        window.add(page);

        const kbdGroup = new Adw.PreferencesGroup({
            title: _('Keyboard'),
            description: _('Virtual keyboard appearance and behavior'),
        });
        page.add(kbdGroup);

        const heightRow = new Adw.SpinRow({
            title: _('Keyboard Height'),
            subtitle: _('Height of the virtual keyboard in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 150, upper: 800, step_increment: 10,
            }),
        });
        settings.bind('keyboard-height', heightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        kbdGroup.add(heightRow);

        const opacityRow = new Adw.SpinRow({
            title: _('Keyboard Opacity'),
            subtitle: _('Opacity of the virtual keyboard (0.0 to 1.0)'),
            adjustment: new Gtk.Adjustment({
                lower: 0.1, upper: 1.0, step_increment: 0.05,
            }),
            digits: 2,
        });
        settings.bind('keyboard-opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        kbdGroup.add(opacityRow);

        /* Docking position: manual mapping string <-> selected index */
        const dockRow = new Adw.ComboRow({
            title: _('Docking Position'),
            subtitle: _('Where the keyboard docks on screen'),
            model: new Gtk.StringList({
                strings: [
                    _('Bottom'), _('Top'), _('Left'),
                    _('Right'), _('Floating'),
                ],
            }),
        });
        const setDockFromSettings = () => {
            const idx = POSITION_KEYS.indexOf(settings.get_string('docking-position'));
            dockRow.selected = idx >= 0 ? idx : 0;
        };
        dockRow.connect('notify::selected', () => {
            settings.set_string('docking-position',
                POSITION_KEYS[dockRow.selected] ?? 'bottom');
        });
        settings.connect('changed::docking-position', setDockFromSettings);
        setDockFromSettings();
        kbdGroup.add(dockRow);

        const autoShowRow = new Adw.SwitchRow({
            title: _('Auto-show Keyboard'),
            subtitle: _('Automatically show keyboard when a text field is focused'),
        });
        settings.bind('auto-show-enabled', autoShowRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        kbdGroup.add(autoShowRow);

        /* ---- Typing group ---- */

        const typeGroup = new Adw.PreferencesGroup({
            title: _('Typing'),
            description: _('Prediction and input settings'),
        });
        page.add(typeGroup);

        const predictionRow = new Adw.SwitchRow({
            title: _('Show Prediction Bar'),
            subtitle: _('Display word predictions above the keyboard'),
        });
        settings.bind('show-prediction-bar', predictionRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        typeGroup.add(predictionRow);

        const autocorrectRow = new Adw.SwitchRow({
            title: _('Auto-correction'),
            subtitle: _('Automatically correct misspelled words'),
        });
        settings.bind('auto-correction-enabled', autocorrectRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        typeGroup.add(autocorrectRow);
    }
}
