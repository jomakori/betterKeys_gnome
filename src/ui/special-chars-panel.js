/* src/ui/special-chars-panel.js - Floating special characters panel */

const { GObject, St, Clutter, Pango, Gtk, Gio, GLib } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var SpecialCharsPanel = GObject.registerClass(
class SpecialCharsPanel extends St.BoxLayout {
    _init(settingsManager) {
        super._init({
            style_class: 'betterkeys-special-chars-panel',
            vertical: true,
            reactive: true,
            can_focus: true,
            visible: false
        });

        this._settings = settingsManager;
        this._isVisible = false;
        this._categories = ['all', 'math', 'arrows', 'currency', 'punctuation', 'technical', 'shapes', 'misc'];
        this._currentCategory = 'all';
        this._searchQuery = '';
        this._panelWidth = 500;
        this._panelHeight = 500;
        this._charSize = 36;
        this._charsPerRow = 10;

        // UI components
        this._header = null;
        this._searchEntry = null;
        this._categoryTabs = null;
        this._scrollView = null;
        this._charsGrid = null;
        this._footer = null;
        this._closeButton = null;

        // State
        this._charButtons = new Map();
        this._categoryButtons = new Map();

        // Build UI
        this._buildUI();

        // Connect signals
        this._connectSignals();

        // Load initial characters
        this._refreshChars();

        log('[betterKeys] SpecialCharsPanel initialized');
    }

    _buildUI() {
        this.remove_all_children();

        // Header
        this._header = new St.BoxLayout({
            style_class: 'betterkeys-special-chars-header',
            vertical: false,
            x_expand: true
        });

        const title = new St.Label({
            style_class: 'betterkeys-special-chars-title',
            text: _('Special Characters'),
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._closeButton = new St.Button({
            style_class: 'betterkeys-special-chars-close-button',
            reactive: true,
            can_focus: true,
            label: '×'
        });
        this._closeButton.connect('clicked', () => this.hide());

        this._header.add_child(title);
        this._header.add_child(this._closeButton);

        // Search entry
        this._searchEntry = new St.Entry({
            style_class: 'betterkeys-special-chars-search',
            hint_text: _('Search characters...'),
            x_expand: true,
            can_focus: true
        });
        this._searchEntry.connect('text-changed', () => {
            this._searchQuery = this._searchEntry.get_text();
            this._refreshChars();
        });

        // Category tabs
        this._categoryTabs = new St.BoxLayout({
            style_class: 'betterkeys-special-chars-category-tabs',
            vertical: false,
            x_expand: true
        });

        // Scrollable grid
        this._scrollView = new St.ScrollView({
            style_class: 'betterkeys-special-chars-scroll',
            x_expand: true,
            y_expand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });

        this._charsGrid = new St.Widget({
            layout_manager: new Clutter.GridLayout(),
            style_class: 'betterkeys-special-chars-grid',
            x_expand: true,
            y_expand: true
        });

        this._scrollView.add_actor(this._charsGrid);

        // Footer
        this._footer = new St.BoxLayout({
            style_class: 'betterkeys-special-chars-footer',
            vertical: false,
            x_expand: true
        });

        this._charInfoLabel = new St.Label({
            style_class: 'betterkeys-special-chars-info',
            text: '',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._footer.add_child(this._charInfoLabel);

        // Assemble
        this.add_child(this._header);
        this.add_child(this._searchEntry);
        this.add_child(this._categoryTabs);
        this.add_child(this._scrollView);
        this.add_child(this._footer);

        this.width = this._panelWidth;
        this.height = this._panelHeight;

        // Build category tabs
        this._refreshCategories();
    }

    _refreshCategories() {
        this._categoryTabs.remove_all_children();
        this._categoryButtons.clear();

        this._categories.forEach(category => {
            const button = this._createCategoryButton(category);
            this._categoryTabs.add_child(button);
            this._categoryButtons.set(category, button);
        });

        this._selectCategory(this._currentCategory);
    }

    _createCategoryButton(category) {
        const label = this._getCategoryLabel(category);
        const button = new St.Button({
            style_class: 'betterkeys-special-chars-category-button',
            reactive: true,
            can_focus: true,
            label: label
        });

        button.connect('clicked', () => {
            this._selectCategory(category);
        });

        return button;
    }

    _getCategoryLabel(category) {
        const labels = {
            'all': _('All'),
            'math': _('Math'),
            'arrows': _('Arrows'),
            'currency': _('Currency'),
            'punctuation': _('Punctuation'),
            'technical': _('Technical'),
            'shapes': _('Shapes'),
            'misc': _('Misc')
        };
        return labels[category] || category;
    }

    _selectCategory(category) {
        if (this._currentCategory && this._categoryButtons.has(this._currentCategory)) {
            const prevButton = this._categoryButtons.get(this._currentCategory);
            prevButton.remove_style_class_name('betterkeys-special-chars-category-selected');
        }

        this._currentCategory = category;
        const button = this._categoryButtons.get(category);
        if (button) {
            button.add_style_class_name('betterkeys-special-chars-category-selected');
        }

        this._refreshChars();
    }

    _refreshChars() {
        this._charButtons.forEach(button => button.destroy());
        this._charButtons.clear();
        this._charsGrid.destroy_all_children();

        const symbols = this._getSymbolsForCurrentCategory();

        const gridLayout = this._charsGrid.layout_manager;
        gridLayout.set_column_spacing(4);
        gridLayout.set_row_spacing(4);

        symbols.forEach((symbol, index) => {
            const row = Math.floor(index / this._charsPerRow);
            const col = index % this._charsPerRow;

            const button = this._createCharButton(symbol);
            gridLayout.attach(button, col, row, 1, 1);
            this._charButtons.set(symbol.char, button);
        });

        const rows = Math.ceil(symbols.length / this._charsPerRow);
        this._charsGrid.height = rows * (this._charSize + 4);

        this._updateFooterInfo(symbols.length);

        if (symbols.length === 0) {
            const placeholder = new St.Label({
                style_class: 'betterkeys-special-chars-placeholder',
                text: this._searchQuery ? _('No matching characters') : _('No characters'),
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            gridLayout.attach(placeholder, 0, 0, this._charsPerRow, 1);
        }
    }

    _getSymbolsForCurrentCategory() {
        // Simplified symbol set
        const allSymbols = [
            { char: '±', name: 'Plus-minus', category: 'math' },
            { char: '×', name: 'Multiplication', category: 'math' },
            { char: '÷', name: 'Division', category: 'math' },
            { char: '√', name: 'Square root', category: 'math' },
            { char: '∞', name: 'Infinity', category: 'math' },
            { char: '←', name: 'Left arrow', category: 'arrows' },
            { char: '→', name: 'Right arrow', category: 'arrows' },
            { char: '↑', name: 'Up arrow', category: 'arrows' },
            { char: '↓', name: 'Down arrow', category: 'arrows' },
            { char: '€', name: 'Euro', category: 'currency' },
            { char: '£', name: 'Pound', category: 'currency' },
            { char: '¥', name: 'Yen', category: 'currency' },
            { char: '¢', name: 'Cent', category: 'currency' },
            { char: '«', name: 'Left quote', category: 'punctuation' },
            { char: '»', name: 'Right quote', category: 'punctuation' },
            { char: '©', name: 'Copyright', category: 'technical' },
            { char: '®', name: 'Registered', category: 'technical' },
            { char: '™', name: 'Trademark', category: 'technical' },
            { char: '■', name: 'Black square', category: 'shapes' },
            { char: '●', name: 'Black circle', category: 'shapes' },
            { char: '▲', name: 'Black triangle', category: 'shapes' },
            { char: '★', name: 'Black star', category: 'shapes' },
            { char: '♠', name: 'Spade', category: 'misc' },
            { char: '♣', name: 'Club', category: 'misc' },
            { char: '♥', name: 'Heart', category: 'misc' },
            { char: '♦', name: 'Diamond', category: 'misc' }
        ];

        let filtered = allSymbols;

        if (this._searchQuery) {
            const query = this._searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(query) ||
                s.char.includes(query)
            );
        } else if (this._currentCategory !== 'all') {
            filtered = filtered.filter(s => s.category === this._currentCategory);
        }

        return filtered;
    }

    _createCharButton(symbol) {
        const button = new St.Button({
            style_class: 'betterkeys-special-chars-button',
            reactive: true,
            can_focus: true,
            label: symbol.char,
            width: this._charSize,
            height: this._charSize
        });

        button._symbol = symbol;

        button.connect('clicked', () => {
            this._onCharClicked(symbol);
        });

        button.connect('enter-event', () => {
            this._showCharTooltip(button, symbol);
            return false;
        });

        button.connect('leave-event', () => {
            this._hideCharTooltip();
            return false;
        });

        return button;
    }

    _showCharTooltip(button, symbol) {
        const unicode = 'U+' + symbol.char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        const tooltipText = `${symbol.name} (${unicode})`;

        const tooltip = new St.Label({
            style_class: 'betterkeys-special-chars-tooltip',
            text: tooltipText
        });

        const [x, y] = button.get_transformed_position();
        tooltip.x = x;
        tooltip.y = y - 30;

        this.add_child(tooltip);
        button._tooltip = tooltip;

        this._charInfoLabel.text = tooltipText;
    }

    _hideCharTooltip() {
        this._charButtons.forEach(button => {
            if (button._tooltip) {
                this.remove_child(button._tooltip);
                button._tooltip.destroy();
                button._tooltip = null;
            }
        });

        this._charInfoLabel.text = '';
    }

    _updateFooterInfo(count) {
        let infoText = '';
        if (this._searchQuery) {
            infoText = ngettext('%d character found', '%d characters found', count).format(count);
        } else {
            infoText = ngettext('%d character', '%d characters', count).format(count);
        }
        this._charInfoLabel.text = infoText;
    }

    _onCharClicked(symbol) {
        this.emit('char-selected', symbol.char, symbol.name);

        const button = this._charButtons.get(symbol.char);
        if (button) {
            button.add_style_class_name('betterkeys-special-chars-button-selected');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                button.remove_style_class_name('betterkeys-special-chars-button-selected');
                return false;
            });
        }

        if (this._settings && this._settings.get_boolean('special-chars-auto-hide')) {
            this.hide();
        }
    }

    _connectSignals() {
        if (this._settings) {
            this._settings.connect('changed', (settings, key) => {
                if (key === 'special-chars-panel-size') {
                    this._updatePanelSize();
                }
            });
        }

        this.connect('key-press-event', (actor, event) => this._onKeyPress(event));
    }

    _updatePanelSize() {
        const size = this._settings ? this._settings.get_string('special-chars-panel-size') : 'medium';
        switch (size) {
            case 'small':
                this._panelWidth = 400;
                this._panelHeight = 400;
                this._charSize = 32;
                this._charsPerRow = 8;
                break;
            case 'large':
                this._panelWidth = 600;
                this._panelHeight = 600;
                this._charSize = 40;
                this._charsPerRow = 12;
                break;
            default:
                this._panelWidth = 500;
                this._panelHeight = 500;
                this._charSize = 36;
                this._charsPerRow = 10;
        }

        this.width = this._panelWidth;
        this.height = this._panelHeight;
        this._refreshChars();
    }

    _onKeyPress(event) {
        const keyval = event.get_key_symbol();

        switch (keyval) {
            case Clutter.Escape:
                this.hide();
                return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    showAt(x, y) {
        if (this._isVisible) return;

        if (!this.get_parent()) {
            Main.uiGroup.add_child(this);
        }

        this._updatePanelSize();

        const [screenWidth, screenHeight] = global.stage.get_size();
        let finalX = x;
        let finalY = y;

        if (finalX + this._panelWidth > screenWidth) {
            finalX = screenWidth - this._panelWidth - 10;
        }
        if (finalY + this._panelHeight > screenHeight) {
            finalY = screenHeight - this._panelHeight - 10;
        }
        if (finalX < 10) finalX = 10;
        if (finalY < 10) finalY = 10;

        this.set_position(finalX, finalY);
        this.show();
        this._isVisible = true;
        this._searchEntry.grab_key_focus();
        this._refreshChars();
        this.emit('shown');
    }

    show() {
        const [screenWidth, screenHeight] = global.stage.get_size();
        const defaultX = Math.floor((screenWidth - this._panelWidth) / 2);
        const defaultY = screenHeight - this._panelHeight - 100;
        this.showAt(defaultX, defaultY);
    }

    hide() {
        if (!this._isVisible) return;

        this._isVisible = false;
        this.hide();
        this._searchQuery = '';
        this._searchEntry.set_text('');
        this.emit('hidden');
    }

    toggle(x, y) {
        if (this._isVisible) {
            this.hide();
        } else if (x !== undefined && y !== undefined) {
            this.showAt(x, y);
        } else {
            this.show();
        }
    }

    isVisible() {
        return this._isVisible;
    }

    setSettingsManager(settingsManager) {
        this._settings = settingsManager;
        this._updatePanelSize();
    }

    getStats() {
        return {
            visible: this._isVisible,
            currentCategory: this._currentCategory,
            charCount: this._charButtons.size,
            searchQuery: this._searchQuery,
            panelWidth: this._panelWidth,
            panelHeight: this._panelHeight
        };
    }

    destroy() {
        this._hideCharTooltip();
        this._charButtons.forEach(button => button.destroy());
        this._charButtons.clear();
        this._categoryButtons.clear();

        if (this.get_parent()) {
            this.get_parent().remove_child(this);
        }

        super.destroy();
    }
});

SpecialCharsPanel.signals = {
    'char-selected': { param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING] },
    'shown': { param_types: [] },
    'hidden': { param_types: [] }
};
