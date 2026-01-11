/* src/ui/theme-manager.js - Theme management for betterKeys */

const { GObject, Gio, GLib, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const ThemeManagerClass = GObject.registerClass(
class ThemeManager extends GObject.Object {
    _init(settingsManager) {
        super._init();

        this._settings = settingsManager;
        this._currentTheme = 'light';
        this._themes = new Map();
        this._cssProvider = null;
        this._systemThemeSync = false;
        this._accentColor = '#007bff';
        this._fontSize = 'medium';
        this._opacity = 0.95;
        this._systemSettings = null;
        this._systemHandlerIds = [];

        // Load built-in themes
        this._loadBuiltinThemes();

        // Load custom themes from GSettings
        this._loadCustomThemes();

        // Apply initial theme
        this._applyTheme(this._currentTheme);

        // Setup system theme detection if enabled
        this._setupSystemThemeDetection();

        log('[betterKeys] ThemeManager initialized');
    }

    _loadBuiltinThemes() {
        // Light theme
        this._themes.set('light', {
            id: 'light',
            name: _('Light'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#ffffff',
                '--betterkeys-key-bg': '#f0f0f0',
                '--betterkeys-key-border': '#cccccc',
                '--betterkeys-key-text': '#333333',
                '--betterkeys-key-pressed-bg': '#d0d0d0',
                '--betterkeys-key-hover-bg': '#e0e0e0',
                '--betterkeys-panel-bg': '#f8f8f8',
                '--betterkeys-panel-border': '#dddddd',
                '--betterkeys-text': '#222222',
                '--betterkeys-accent': '#007bff',
                '--betterkeys-error': '#dc3545',
                '--betterkeys-success': '#28a745',
                '--betterkeys-warning': '#ffc107'
            },
            description: _('Default light theme')
        });

        // Dark theme
        this._themes.set('dark', {
            id: 'dark',
            name: _('Dark'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#1e1e1e',
                '--betterkeys-key-bg': '#2d2d2d',
                '--betterkeys-key-border': '#404040',
                '--betterkeys-key-text': '#e0e0e0',
                '--betterkeys-key-pressed-bg': '#3d3d3d',
                '--betterkeys-key-hover-bg': '#353535',
                '--betterkeys-panel-bg': '#252525',
                '--betterkeys-panel-border': '#404040',
                '--betterkeys-text': '#f0f0f0',
                '--betterkeys-accent': '#4dabf7',
                '--betterkeys-error': '#ff6b6b',
                '--betterkeys-success': '#51cf66',
                '--betterkeys-warning': '#ffd43b'
            },
            description: _('Dark theme for low-light environments')
        });

        // High contrast theme
        this._themes.set('high-contrast', {
            id: 'high-contrast',
            name: _('High Contrast'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#000000',
                '--betterkeys-key-bg': '#ffffff',
                '--betterkeys-key-border': '#000000',
                '--betterkeys-key-text': '#000000',
                '--betterkeys-key-pressed-bg': '#cccccc',
                '--betterkeys-key-hover-bg': '#eeeeee',
                '--betterkeys-panel-bg': '#ffffff',
                '--betterkeys-panel-border': '#000000',
                '--betterkeys-text': '#000000',
                '--betterkeys-accent': '#0000ff',
                '--betterkeys-error': '#ff0000',
                '--betterkeys-success': '#00ff00',
                '--betterkeys-warning': '#ffff00'
            },
            description: _('High contrast theme for accessibility')
        });

        // Solarized light
        this._themes.set('solarized-light', {
            id: 'solarized-light',
            name: _('Solarized Light'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#fdf6e3',
                '--betterkeys-key-bg': '#eee8d5',
                '--betterkeys-key-border': '#93a1a1',
                '--betterkeys-key-text': '#586e75',
                '--betterkeys-key-pressed-bg': '#ddd6c1',
                '--betterkeys-key-hover-bg': '#e6dfca',
                '--betterkeys-panel-bg': '#f5efd9',
                '--betterkeys-panel-border': '#93a1a1',
                '--betterkeys-text': '#657b83',
                '--betterkeys-accent': '#268bd2',
                '--betterkeys-error': '#dc322f',
                '--betterkeys-success': '#859900',
                '--betterkeys-warning': '#b58900'
            },
            description: _('Solarized light color scheme')
        });

        // Solarized dark
        this._themes.set('solarized-dark', {
            id: 'solarized-dark',
            name: _('Solarized Dark'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#002b36',
                '--betterkeys-key-bg': '#073642',
                '--betterkeys-key-border': '#586e75',
                '--betterkeys-key-text': '#839496',
                '--betterkeys-key-pressed-bg': '#0a4c5c',
                '--betterkeys-key-hover-bg': '#094551',
                '--betterkeys-panel-bg': '#01313f',
                '--betterkeys-panel-border': '#586e75',
                '--betterkeys-text': '#93a1a1',
                '--betterkeys-accent': '#2aa198',
                '--betterkeys-error': '#cb4b16',
                '--betterkeys-success': '#859900',
                '--betterkeys-warning': '#b58900'
            },
            description: _('Solarized dark color scheme')
        });

        // Nord theme
        this._themes.set('nord', {
            id: 'nord',
            name: _('Nord'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#2e3440',
                '--betterkeys-key-bg': '#3b4252',
                '--betterkeys-key-border': '#4c566a',
                '--betterkeys-key-text': '#d8dee9',
                '--betterkeys-key-pressed-bg': '#434c5e',
                '--betterkeys-key-hover-bg': '#4c566a',
                '--betterkeys-panel-bg': '#3b4252',
                '--betterkeys-panel-border': '#4c566a',
                '--betterkeys-text': '#e5e9f0',
                '--betterkeys-accent': '#88c0d0',
                '--betterkeys-error': '#bf616a',
                '--betterkeys-success': '#a3be8c',
                '--betterkeys-warning': '#ebcb8b'
            },
            description: _('Nord color scheme')
        });

        // Gruvbox theme
        this._themes.set('gruvbox', {
            id: 'gruvbox',
            name: _('Gruvbox'),
            type: 'builtin',
            colors: {
                '--betterkeys-bg': '#282828',
                '--betterkeys-key-bg': '#3c3836',
                '--betterkeys-key-border': '#504945',
                '--betterkeys-key-text': '#ebdbb2',
                '--betterkeys-key-pressed-bg': '#504945',
                '--betterkeys-key-hover-bg': '#45403d',
                '--betterkeys-panel-bg': '#32302f',
                '--betterkeys-panel-border': '#504945',
                '--betterkeys-text': '#fbf1c7',
                '--betterkeys-accent': '#fe8019',
                '--betterkeys-error': '#fb4934',
                '--betterkeys-success': '#b8bb26',
                '--betterkeys-warning': '#fabd2f'
            },
            description: _('Gruvbox color scheme')
        });
    }

    _loadCustomThemes() {
        try {
            const serialized = this._settings._settings.get_string('custom-themes');
            if (serialized && serialized.length > 0) {
                const customThemes = JSON.parse(serialized);
                customThemes.forEach(theme => {
                    if (theme.id && theme.name && theme.colors) {
                        theme.type = 'custom';
                        this._themes.set(theme.id, theme);
                    }
                });
                log(`[betterKeys] Loaded ${customThemes.length} custom themes`);
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load custom themes: ${error}`);
        }
    }

    _saveCustomThemes() {
        const customThemes = [];
        this._themes.forEach(theme => {
            if (theme.type === 'custom') {
                customThemes.push(theme);
            }
        });
        try {
            const serialized = JSON.stringify(customThemes);
            this._settings._settings.set_string('custom-themes', serialized);
        } catch (error) {
            logError(`[betterKeys] Failed to save custom themes: ${error}`);
        }
    }

    _setupSystemThemeDetection() {
        // Check if system theme sync is enabled
        this._systemThemeSync = this._settings.get_boolean('theme-sync-system');

        if (this._systemThemeSync) {
            // Clean up any existing connections
            this._cleanupSystemThemeDetection();

            // Connect to system theme changes
            this._systemSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });

            const gtkHandlerId = this._systemSettings.connect('changed::gtk-theme',
                () => this._updateThemeFromSystem());
            this._systemHandlerIds.push(gtkHandlerId);

            // Also monitor color-scheme preference (GNOME 42+)
            if (this._systemSettings.schema_has_key('color-scheme')) {
                const colorHandlerId = this._systemSettings.connect('changed::color-scheme',
                    () => this._updateThemeFromSystem());
                this._systemHandlerIds.push(colorHandlerId);
            }

            // Apply initial system theme
            this._updateThemeFromSystem();

            log('[betterKeys] System theme detection enabled');
        } else {
            this._cleanupSystemThemeDetection();
        }
    }

    _cleanupSystemThemeDetection() {
        if (this._systemSettings && this._systemHandlerIds.length > 0) {
            this._systemHandlerIds.forEach(handlerId => {
                this._systemSettings.disconnect(handlerId);
            });
            this._systemHandlerIds = [];
            this._systemSettings = null;
        }
    }

    _updateThemeFromSystem() {
        if (!this._systemSettings || !this._systemThemeSync) {
            return;
        }

        let themeId = 'light'; // default

        // First check color-scheme (prefers-dark)
        if (this._systemSettings.schema_has_key('color-scheme')) {
            const colorScheme = this._systemSettings.get_string('color-scheme');
            if (colorScheme === 'prefer-dark') {
                themeId = 'dark';
            } else if (colorScheme === 'prefer-light') {
                themeId = 'light';
            }
        }

        // Fallback to gtk-theme name detection
        if (themeId === 'light') {
            const gtkTheme = this._systemSettings.get_string('gtk-theme').toLowerCase();
            if (gtkTheme.includes('dark')) {
                themeId = 'dark';
            }
        }

        // Apply theme if different from current
        if (themeId !== this._currentTheme) {
            this.setTheme(themeId);
        }
    }

    _applyTheme(themeId) {
        const theme = this._themes.get(themeId);
        if (!theme) {
            logError(`[betterKeys] Theme not found: ${themeId}`);
            return;
        }

        this._currentTheme = themeId;

        // Create CSS provider if not exists
        if (!this._cssProvider) {
            this._cssProvider = new St.CssProvider();
            St.StyleContext.add_provider_for_screen(
                global.screen,
                this._cssProvider,
                St.STYLE_PROVIDER_PRIORITY_APPLICATION
            );
        }

        // Build CSS string
        let css = ':root {\n';
        Object.entries(theme.colors).forEach(([variable, value]) => {
            css += `  ${variable}: ${value};\n`;
        });

        // Add accent color override if custom accent is set
        if (this._accentColor !== theme.colors['--betterkeys-accent']) {
            css += `  --betterkeys-accent: ${this._accentColor};\n`;
        }

        // Add font size scaling
        const fontSizeMap = {
            'small': '0.9em',
            'medium': '1em',
            'large': '1.1em',
            'extra-large': '1.25em'
        };
        const fontSize = fontSizeMap[this._fontSize] || '1em';
        css += `  --betterkeys-font-size: ${fontSize};\n`;

        // Add opacity
        css += `  --betterkeys-opacity: ${this._opacity};\n`;

        css += '}\n';

        // Apply CSS
        try {
            this._cssProvider.load_from_data(css, -1);
            log(`[betterKeys] Applied theme: ${themeId}`);
            this.emit('theme-changed', themeId);
        } catch (error) {
            logError(`[betterKeys] Failed to apply theme CSS: ${error}`);
        }
    }

    /**
     * Get all available themes.
     * @returns {Array} Array of theme objects.
     */
    getThemes() {
        return Array.from(this._themes.values());
    }

    /**
     * Get current theme.
     * @returns {Object} Current theme object.
     */
    getCurrentTheme() {
        return this._themes.get(this._currentTheme);
    }

    /**
     * Switch to a different theme.
     * @param {string} themeId - Theme identifier.
     */
    setTheme(themeId) {
        if (!this._themes.has(themeId)) {
            logError(`[betterKeys] Cannot switch to unknown theme: ${themeId}`);
            return;
        }

        if (themeId === this._currentTheme) {
            return;
        }

        this._applyTheme(themeId);

        // Save to GSettings
        this._settings._settings.set_string('theme-name', themeId);
    }

    /**
     * Create a custom theme.
     * @param {Object} themeData - Theme data with id, name, colors, description.
     * @returns {boolean} True if theme was created.
     */
    createCustomTheme(themeData) {
        if (!themeData.id || !themeData.name || !themeData.colors) {
            logError('[betterKeys] Invalid theme data');
            return false;
        }

        if (this._themes.has(themeData.id)) {
            logError(`[betterKeys] Theme already exists: ${themeData.id}`);
            return false;
        }

        themeData.type = 'custom';
        this._themes.set(themeData.id, themeData);
        this._saveCustomThemes();

        this.emit('custom-theme-added', themeData.id);
        return true;
    }

    /**
     * Update an existing custom theme.
     * @param {string} themeId - Theme identifier.
     * @param {Object} updates - Partial theme data to update.
     * @returns {boolean} True if theme was updated.
     */
    updateCustomTheme(themeId, updates) {
        const theme = this._themes.get(themeId);
        if (!theme || theme.type !== 'custom') {
            logError(`[betterKeys] Cannot update non-custom theme: ${themeId}`);
            return false;
        }

        Object.assign(theme, updates);
        this._saveCustomThemes();

        // If this is the current theme, reapply
        if (themeId === this._currentTheme) {
            this._applyTheme(themeId);
        }

        this.emit('custom-theme-updated', themeId);
        return true;
    }

    /**
     * Delete a custom theme.
     * @param {string} themeId - Theme identifier.
     * @returns {boolean} True if theme was deleted.
     */
    deleteCustomTheme(themeId) {
        const theme = this._themes.get(themeId);
        if (!theme || theme.type !== 'custom') {
            logError(`[betterKeys] Cannot delete non-custom theme: ${themeId}`);
            return false;
        }

        // Cannot delete if it's the current theme
        if (themeId === this._currentTheme) {
            logError('[betterKeys] Cannot delete current theme');
            return false;
        }

        this._themes.delete(themeId);
        this._saveCustomThemes();

        this.emit('custom-theme-deleted', themeId);
        return true;
    }

    /**
     * Set accent color.
     * @param {string} color - CSS color value.
     */
    setAccentColor(color) {
        this._accentColor = color;
        this._applyTheme(this._currentTheme);
        this._settings._settings.set_string('accent-color', color);
    }

    /**
     * Set font size.
     * @param {string} size - One of 'small', 'medium', 'large', 'extra-large'.
     */
    setFontSize(size) {
        const validSizes = ['small', 'medium', 'large', 'extra-large'];
        if (!validSizes.includes(size)) {
            logError(`[betterKeys] Invalid font size: ${size}`);
            return;
        }

        this._fontSize = size;
        this._applyTheme(this._currentTheme);
        this._settings._settings.set_string('font-size', size);
    }

    /**
     * Set keyboard opacity.
     * @param {number} opacity - Opacity value between 0.0 and 1.0.
     */
    setOpacity(opacity) {
        const clamped = Math.max(0.1, Math.min(1.0, opacity));
        this._opacity = clamped;
        this._applyTheme(this._currentTheme);
        this._settings._settings.set_double('keyboard-opacity', clamped);
    }

    /**
     * Enable or disable system theme synchronization.
     * @param {boolean} enabled - Whether to sync with system theme.
     */
    setSystemThemeSync(enabled) {
        this._systemThemeSync = enabled;
        this._settings._settings.set_boolean('theme-sync-system', enabled);

        if (enabled) {
            this._setupSystemThemeDetection();
        }
    }

    /**
     * Export a theme as JSON.
     * @param {string} themeId - Theme identifier.
     * @returns {string} JSON string.
     */
    exportTheme(themeId) {
        const theme = this._themes.get(themeId);
        if (!theme) {
            return '';
        }

        // Remove internal properties
        const exportable = {
            id: theme.id,
            name: theme.name,
            colors: theme.colors,
            description: theme.description || ''
        };

        return JSON.stringify(exportable, null, 2);
    }

    /**
     * Import a theme from JSON.
     * @param {string} json - JSON string containing theme data.
     * @returns {boolean} True if theme was imported.
     */
    importTheme(json) {
        try {
            const themeData = JSON.parse(json);
            if (!themeData.id || !themeData.name || !themeData.colors) {
                logError('[betterKeys] Invalid theme JSON');
                return false;
            }

            // Ensure unique ID
            let themeId = themeData.id;
            let counter = 1;
            while (this._themes.has(themeId)) {
                themeId = `${themeData.id}-${counter}`;
                counter++;
            }

            themeData.id = themeId;
            themeData.type = 'custom';

            this._themes.set(themeId, themeData);
            this._saveCustomThemes();

            this.emit('custom-theme-added', themeId);
            return true;
        } catch (error) {
            logError(`[betterKeys] Failed to import theme: ${error}`);
            return false;
        }
    }

    /**
     * Generate a preview of a theme.
     * @param {string} themeId - Theme identifier.
     * @returns {Object} Preview object with colors and metadata.
     */
    generatePreview(themeId) {
        const theme = this._themes.get(themeId);
        if (!theme) {
            return null;
        }

        return {
            id: theme.id,
            name: theme.name,
            colors: theme.colors,
            description: theme.description,
            type: theme.type
        };
    }

    /**
     * Reset to default theme.
     */
    resetToDefault() {
        this.setTheme('light');
        this.setAccentColor('#007bff');
        this.setFontSize('medium');
        this.setOpacity(0.95);
        this.setSystemThemeSync(false);
    }

    /**
     * Get CSS variables for a theme.
     * @param {string} themeId - Theme identifier.
     * @returns {string} CSS string.
     */
    getThemeCSS(themeId) {
        const theme = this._themes.get(themeId);
        if (!theme) {
            return '';
        }

        let css = ':root {\n';
        Object.entries(theme.colors).forEach(([variable, value]) => {
            css += `  ${variable}: ${value};\n`;
        });
        css += '}\n';
        return css;
    }

    /**
     * Validate a theme object.
     * @param {Object} theme - Theme object to validate.
     * @returns {Array} Array of validation errors, empty if valid.
     */
    validateTheme(theme) {
        const errors = [];

        if (!theme.id || typeof theme.id !== 'string') {
            errors.push('Theme must have a string id');
        }

        if (!theme.name || typeof theme.name !== 'string') {
            errors.push('Theme must have a string name');
        }

        if (!theme.colors || typeof theme.colors !== 'object') {
            errors.push('Theme must have a colors object');
        } else {
            const requiredVars = [
                '--betterkeys-bg',
                '--betterkeys-key-bg',
                '--betterkeys-key-border',
                '--betterkeys-key-text',
                '--betterkeys-key-pressed-bg',
                '--betterkeys-key-hover-bg',
                '--betterkeys-panel-bg',
                '--betterkeys-panel-border',
                '--betterkeys-text',
                '--betterkeys-accent',
                '--betterkeys-error',
                '--betterkeys-success',
                '--betterkeys-warning'
            ];

            requiredVars.forEach(variable => {
                if (!theme.colors[variable]) {
                    errors.push(`Missing required color variable: ${variable}`);
                }
            });
        }

        return errors;
    }

    /**
     * Create a theme from current settings.
     * @param {string} name - Name for the new theme.
     * @param {string} description - Optional description.
     * @returns {string} Theme ID of the created theme.
     */
    createThemeFromCurrent(name, description = '') {
        const currentTheme = this.getCurrentTheme();
        if (!currentTheme) {
            return '';
        }

        const themeId = `custom-${Date.now()}`;
        const themeData = {
            id: themeId,
            name: name,
            colors: { ...currentTheme.colors },
            description: description,
            type: 'custom'
        };

        // Override accent color with current accent
        themeData.colors['--betterkeys-accent'] = this._accentColor;

        this.createCustomTheme(themeData);
        return themeId;
    }

    /**
     * Clean up resources.
     */
    destroy() {
        if (this._cssProvider) {
            St.StyleContext.remove_provider_for_screen(
                global.screen,
                this._cssProvider
            );
            this._cssProvider = null;
        }

        // Clean up system theme detection
        this._cleanupSystemThemeDetection();

        log('[betterKeys] ThemeManager destroyed');
    }
});

// Add signals to the class
ThemeManagerClass.signals = {
    'theme-changed': { param_types: [GObject.TYPE_STRING] },
    'custom-theme-added': { param_types: [GObject.TYPE_STRING] },
    'custom-theme-updated': { param_types: [GObject.TYPE_STRING] },
    'custom-theme-deleted': { param_types: [GObject.TYPE_STRING] }
};
