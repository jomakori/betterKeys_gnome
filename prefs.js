const ExtensionPreferences = imports.misc.extensionPreferences.ExtensionPreferences;

var BetterKeysPreferences = class extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Minimal - just create an empty preferences page
        const { Adw } = imports.gi;
        const page = new Adw.PreferencesPage();
        page.set_title('betterKeys');
        window.add(page);
    }
};
