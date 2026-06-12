import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import { ExtensionPreferences, gettext as _ } from 'resource://org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BetterKeysPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'betterKeys',
            icon_name: 'input-keyboard-symbolic',
        });
        window.add(page);

        const keyboardGroup = new Adw.PreferencesGroup({
            title: _('Keyboard'),
            description: _('Virtual keyboard appearance and behavior'),
        });
        page.add(keyboardGroup);

        const heightRow = new Adw.SpinRow({
            title: _('Keyboard Height'),
            subtitle: _('Height of the virtual keyboard in pixels'),
            adjustment: new Gtk.Adjustment({
                lower: 150,
                upper: 800,
                step_increment: 10,
            }),
        });
        settings.bind('keyboard-height', heightRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(heightRow);

        const opacityRow = new Adw.SpinRow({
            title: _('Keyboard Opacity'),
            subtitle: _('Opacity of the virtual keyboard (0.0 to 1.0)'),
            adjustment: new Gtk.Adjustment({
                lower: 0.1,
                upper: 1.0,
                step_increment: 0.05,
            }),
            digits: 2,
        });
        settings.bind('keyboard-opacity', opacityRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(opacityRow);

        const dockRow = new Adw.ComboRow({
            title: _('Docking Position'),
            subtitle: _('Where the keyboard docks on screen'),
            model: new Gtk.StringList({
                strings: [_('Bottom'), _('Top'), _('Left'), _('Right'), _('Floating')],
            }),
        });
        keyboardGroup.add(dockRow);

        const autoShowRow = new Adw.SwitchRow({
            title: _('Auto-show Keyboard'),
            subtitle: _('Automatically show keyboard when a text field is focused'),
        });
        settings.bind('auto-show-enabled', autoShowRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(autoShowRow);

        const autoHideRow = new Adw.SwitchRow({
            title: _('Auto-hide Keyboard'),
            subtitle: _('Automatically hide when no text field is active'),
        });
        settings.bind('auto-hide-enabled', autoHideRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        keyboardGroup.add(autoHideRow);

        const typingGroup = new Adw.PreferencesGroup({
            title: _('Typing'),
            description: _('Prediction, correction, and input settings'),
        });
        page.add(typingGroup);

        const predictionRow = new Adw.SwitchRow({
            title: _('Show Prediction Bar'),
            subtitle: _('Display word predictions above the keyboard'),
        });
        settings.bind('show-prediction-bar', predictionRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        typingGroup.add(predictionRow);

        const autocorrectRow = new Adw.SwitchRow({
            title: _('Auto-correction'),
            subtitle: _('Automatically correct misspelled words'),
        });
        settings.bind('auto-correction-enabled', autocorrectRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        typingGroup.add(autocorrectRow);

        const hapticRow = new Adw.SwitchRow({
            title: _('Haptic Feedback'),
            subtitle: _('Provide haptic feedback on key press'),
        });
        settings.bind('haptic-feedback-enabled', hapticRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        typingGroup.add(hapticRow);

        const soundRow = new Adw.SwitchRow({
            title: _('Key Press Sound'),
            subtitle: _('Play a sound on key press'),
        });
        settings.bind('key-press-sound-enabled', soundRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        typingGroup.add(soundRow);

        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Themes and visual settings'),
        });
        page.add(appearanceGroup);

        const themeRow = new Adw.ComboRow({
            title: _('Theme'),
            subtitle: _('Visual theme for the keyboard'),
            model: new Gtk.StringList({
                strings: [_('Default'), _('Light'), _('Dark'), _('High Contrast'), _('Solarized'), _('Nord'), _('Gruvbox')],
            }),
        });
        appearanceGroup.add(themeRow);

        const autoThemeRow = new Adw.SwitchRow({
            title: _('Auto Dark/Light'),
            subtitle: _('Automatically switch theme based on system dark mode'),
        });
        settings.bind('theme-auto-dark-light', autoThemeRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(autoThemeRow);

        const a11yGroup = new Adw.PreferencesGroup({
            title: _('Accessibility'),
            description: _('Accessibility and assistive features'),
        });
        page.add(a11yGroup);

        const largeKeysRow = new Adw.SwitchRow({
            title: _('Large Keys'),
            subtitle: _('Use enlarged keys for better visibility'),
        });
        settings.bind('large-keys-enabled', largeKeysRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        a11yGroup.add(largeKeysRow);

        const highContrastRow = new Adw.SwitchRow({
            title: _('High Contrast'),
            subtitle: _('Enhanced color contrast for visibility'),
        });
        settings.bind('high-contrast-enabled', highContrastRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        a11yGroup.add(highContrastRow);

        const screenReaderRow = new Adw.SwitchRow({
            title: _('Screen Reader Support'),
            subtitle: _('Enable ATK/ATSPI screen reader compatibility'),
        });
        settings.bind('accessibility-screen-reader', screenReaderRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        a11yGroup.add(screenReaderRow);
    }
}
