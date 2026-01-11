/* src/ui/emoji-panel.js - Floating emoji selection panel */

const { GObject, St, Clutter, Pango, Gtk } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const EmojiPanel = GObject.registerClass(
class EmojiPanel extends St.BoxLayout {
    _init(emojiManager, settingsManager) {
        super._init({
            style_class: 'betterkeys-emoji-panel',
            vertical: true,
            reactive: true,
            can_focus: true,
            visible: false
        });

        this._emojiManager = emojiManager;
        this._settings = settingsManager;
        this._isVisible = false;
        this._categories = [];
        this._currentCategory = null;
        this._searchQuery = '';
        this._skinTone = 'default';
        this._panelWidth = 450;
        this._panelHeight = 500;
        this._emojiSize = 36;
        this._emojiPerRow = 8;

        // UI components
        this._header = null;
        this._searchEntry = null;
        this._categoryTabs = null;
        this._scrollView = null;
        this._emojiGrid = null;
        this._footer = null;
        this._skinToneSelector = null;
        this._closeButton = null;

        // State
        this._emojiButtons = new Map(); // emoji -> button
        this._categoryButtons = new Map(); // category -> button

        // Build UI
        this._buildUI();

        // Connect signals
        this._connectSignals();

        // Load categories and initial emojis
        this._refreshCategories();

        log('[betterKeys] EmojiPanel initialized');
    }

    _buildUI() {
        this.remove_all_children();

        // Header with title and close button
        this._header = new St.BoxLayout({
            style_class: 'betterkeys-emoji-header',
            vertical: false,
            x_expand: true
        });

        const title = new St.Label({
            style_class: 'betterkeys-emoji-title',
            text: _('Emoji'),
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._closeButton = new St.Button({
            style_class: 'betterkeys-emoji-close-button',
            reactive: true,
            can_focus: true,
            label: '×'
        });
        this._closeButton.connect('clicked', () => this.hide());

        this._header.add_child(title);
        this._header.add_child(this._closeButton);

        // Search entry
        this._searchEntry = new St.Entry({
            style_class: 'betterkeys-emoji-search',
            hint_text: _('Search emojis...'),
            x_expand: true,
            can_focus: true
        });
        this._searchEntry.connect('text-changed', () => {
            this._searchQuery = this._searchEntry.get_text();
            this._refreshEmojis();
        });

        // Category tabs
        this._categoryTabs = new St.BoxLayout({
            style_class: 'betterkeys-emoji-category-tabs',
            vertical: false,
            x_expand: true
        });

        // Scrollable emoji grid
        this._scrollView = new St.ScrollView({
            style_class: 'betterkeys-emoji-scroll',
            x_expand: true,
            y_expand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });

        this._emojiGrid = new St.Widget({
            layout_manager: new Clutter.GridLayout(),
            style_class: 'betterkeys-emoji-grid',
            x_expand: true,
            y_expand: true
        });

        this._scrollView.add_actor(this._emojiGrid);

        // Footer with skin tone selector and recently used
        this._footer = new St.BoxLayout({
            style_class: 'betterkeys-emoji-footer',
            vertical: false,
            x_expand: true
        });

        // Skin tone selector
        const skinToneLabel = new St.Label({
            style_class: 'betterkeys-emoji-skin-tone-label',
            text: _('Skin tone:'),
            y_align: Clutter.ActorAlign.CENTER
        });

        this._skinToneSelector = new St.BoxLayout({
            style_class: 'betterkeys-emoji-skin-tone-selector',
            vertical: false
        });

        const recentlyUsedButton = new St.Button({
            style_class: 'betterkeys-emoji-recently-used-button',
            reactive: true,
            can_focus: true,
            label: _('Recently Used')
        });
        recentlyUsedButton.connect('clicked', () => this._showRecentlyUsed());

        this._footer.add_child(skinToneLabel);
        this._footer.add_child(this._skinToneSelector);
        this._footer.add_child(new St.BoxLayout({ x_expand: true })); // spacer
        this._footer.add_child(recentlyUsedButton);

        // Assemble panel
        this.add_child(this._header);
        this.add_child(this._searchEntry);
        this.add_child(this._categoryTabs);
        this.add_child(this._scrollView);
        this.add_child(this._footer);

        // Set initial size
        this.width = this._panelWidth;
        this.height = this._panelHeight;

        // Build skin tone selector
        this._buildSkinToneSelector();
    }

    _buildSkinToneSelector() {
        this._skinToneSelector.remove_all_children();

        const skinTones = this._emojiManager.getAvailableSkinTones();
        skinTones.forEach(tone => {
            const button = new St.Button({
                style_class: `betterkeys-emoji-skin-tone-${tone}`,
                reactive: true,
                can_focus: false,
                label: this._getSkinTonePreview(tone),
                width: 24,
                height: 24
            });

            button.connect('clicked', () => {
                this._emojiManager.setSkinTone(tone);
                this._skinTone = tone;
                this._updateSkinToneSelection();
                this._refreshEmojis(); // Refresh to apply skin tone
            });

            this._skinToneSelector.add_child(button);
        });

        this._updateSkinToneSelection();
    }

    _getSkinTonePreview(tone) {
        // Return a preview emoji for the skin tone
        const previews = {
            'default': '👋',
            'light': '👋🏻',
            'medium-light': '👋🏼',
            'medium': '👋🏽',
            'medium-dark': '👋🏾',
            'dark': '👋🏿'
        };
        return previews[tone] || '👋';
    }

    _updateSkinToneSelection() {
        const skinTones = this._emojiManager.getAvailableSkinTones();
        skinTones.forEach((tone, index) => {
            const button = this._skinToneSelector.get_child_at_index(index);
            if (button) {
                if (tone === this._skinTone) {
                    button.add_style_class_name('betterkeys-emoji-skin-tone-selected');
                } else {
                    button.remove_style_class_name('betterkeys-emoji-skin-tone-selected');
                }
            }
        });
    }

    _connectSignals() {
        // Connect to emoji manager events
        if (this._emojiManager) {
            this._emojiManager.connect('recently-used-updated', () => {
                if (this._currentCategory === 'recently-used') {
                    this._refreshEmojis();
                }
            });
            this._emojiManager.connect('skin-tone-changed', (manager, tone) => {
                this._skinTone = tone;
                this._updateSkinToneSelection();
                this._refreshEmojis();
            });
        }

        // Connect to settings changes
        if (this._settings) {
            this._settings.connect('changed', (settings, key) => {
                if (key === 'emoji-panel-size' || key === 'emoji-size') {
                    this._updatePanelSize();
                }
            });
        }

        // Connect key events for navigation
        this.connect('key-press-event', (actor, event) => this._onKeyPress(event));
    }

    _updatePanelSize() {
        // Update panel dimensions based on settings
        const size = this._settings ? this._settings.get_string('emoji-panel-size') : 'medium';
        let width, height;
        switch (size) {
            case 'small':
                width = 350;
                height = 400;
                this._emojiSize = 32;
                this._emojiPerRow = 7;
                break;
            case 'large':
                width = 550;
                height = 600;
                this._emojiSize = 40;
                this._emojiPerRow = 9;
                break;
            case 'medium':
            default:
                width = 450;
                height = 500;
                this._emojiSize = 36;
                this._emojiPerRow = 8;
        }

        this._panelWidth = width;
        this._panelHeight = height;

        this.width = width;
        this.height = height;

        // Refresh emojis to apply new sizing
        this._refreshEmojis();
    }

    _refreshCategories() {
        this._categoryTabs.remove_all_children();
        this._categoryButtons.clear();

        // Get categories from emoji manager
        this._categories = this._emojiManager.getCategories();

        // Add "Recently Used" category
        this._categories.unshift('recently-used');

        // Add "Search Results" category (will be shown when searching)
        this._categories.push('search-results');

        // Create category buttons
        this._categories.forEach(category => {
            const button = this._createCategoryButton(category);
            this._categoryTabs.add_child(button);
            this._categoryButtons.set(category, button);
        });

        // Select first category
        if (this._categories.length > 0) {
            this._selectCategory(this._categories[0]);
        }
    }

    _createCategoryButton(category) {
        const label = this._getCategoryLabel(category);
        const icon = this._getCategoryIcon(category);

        const button = new St.Button({
            style_class: 'betterkeys-emoji-category-button',
            reactive: true,
            can_focus: true,
            label: icon ? `${icon} ${label}` : label
        });

        button.connect('clicked', () => {
            this._selectCategory(category);
        });

        return button;
    }

    _getCategoryLabel(category) {
        const labels = {
            'recently-used': _('Recent'),
            'search-results': _('Search'),
            'smileys-emotion': _('Smileys'),
            'people-body': _('People'),
            'animals-nature': _('Animals'),
            'food-drink': _('Food'),
            'travel-places': _('Travel'),
            'activities': _('Activities'),
            'objects': _('Objects'),
            'symbols': _('Symbols'),
            'flags': _('Flags')
        };
        return labels[category] || category;
    }

    _getCategoryIcon(category) {
        const icons = {
            'recently-used': '🕒',
            'search-results': '🔍',
            'smileys-emotion': '😀',
            'people-body': '👤',
            'animals-nature': '🐶',
            'food-drink': '🍎',
            'travel-places': '✈️',
            'activities': '⚽',
            'objects': '💡',
            'symbols': '💖',
            'flags': '🇺🇸'
        };
        return icons[category] || '';
    }

    _selectCategory(category) {
        // Deselect previous category
        if (this._currentCategory && this._categoryButtons.has(this._currentCategory)) {
            const prevButton = this._categoryButtons.get(this._currentCategory);
            prevButton.remove_style_class_name('betterkeys-emoji-category-selected');
        }

        // Select new category
        this._currentCategory = category;
        const button = this._categoryButtons.get(category);
        if (button) {
            button.add_style_class_name('betterkeys-emoji-category-selected');
        }

        // Refresh emojis for this category
        this._refreshEmojis();
    }

    _refreshEmojis() {
        // Clear existing emoji buttons
        this._emojiButtons.forEach(button => button.destroy());
        this._emojiButtons.clear();
        this._emojiGrid.destroy_all_children();

        let emojis = [];

        if (this._searchQuery && this._searchQuery.trim() !== '') {
            // Search mode
            emojis = this._emojiManager.searchEmojis(this._searchQuery, 100);
            this._currentCategory = 'search-results';
        } else if (this._currentCategory === 'recently-used') {
            // Recently used emojis
            emojis = this._emojiManager.getRecentlyUsed(100);
        } else if (this._currentCategory) {
            // Regular category
            emojis = this._emojiManager.getEmojisByCategory(this._currentCategory);
        }

        // Create emoji buttons in grid
        const gridLayout = this._emojiGrid.layout_manager;
        gridLayout.set_column_spacing(4);
        gridLayout.set_row_spacing(4);

        emojis.forEach((emoji, index) => {
            const row = Math.floor(index / this._emojiPerRow);
            const col = index % this._emojiPerRow;

            const button = this._createEmojiButton(emoji);
            gridLayout.attach(button, col, row, 1, 1);
            this._emojiButtons.set(emoji.emoji, button);
        });

        // Update grid size
        const rows = Math.ceil(emojis.length / this._emojiPerRow);
        this._emojiGrid.height = rows * (this._emojiSize + 4);

        // Show placeholder if no emojis
        if (emojis.length === 0) {
            const placeholder = new St.Label({
                style_class: 'betterkeys-emoji-placeholder',
                text: this._searchQuery ?
                    _('No matching emojis') :
                    _('No emojis in this category'),
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            gridLayout.attach(placeholder, 0, 0, this._emojiPerRow, 1);
        }
    }

    _createEmojiButton(emoji) {
        const emojiChar = this._emojiManager.getEmojiWithSkinTone(emoji.emoji, this._skinTone);

        const button = new St.Button({
            style_class: 'betterkeys-emoji-button',
            reactive: true,
            can_focus: true,
            label: emojiChar,
            width: this._emojiSize,
            height: this._emojiSize
        });

        // Store emoji reference
        button._emoji = emoji;

        // Connect click event
        button.connect('clicked', () => {
            this._onEmojiClicked(emoji);
        });

        // Connect hover events for tooltip
        button.connect('enter-event', () => {
            this._showEmojiTooltip(button, emoji);
            return false;
        });

        button.connect('leave-event', () => {
            this._hideEmojiTooltip();
            return false;
        });

        return button;
    }

    _showEmojiTooltip(button, emoji) {
        // Create tooltip with emoji name
        const tooltip = new St.Label({
            style_class: 'betterkeys-emoji-tooltip',
            text: emoji.name
        });

        // Position tooltip above button
        const [x, y] = button.get_transformed_position();
        tooltip.x = x;
        tooltip.y = y - 30;

        this.add_child(tooltip);
        button._tooltip = tooltip;
    }

    _hideEmojiTooltip() {
        // Remove any existing tooltip
        this._emojiButtons.forEach(button => {
            if (button._tooltip) {
                this.remove_child(button._tooltip);
                button._tooltip.destroy();
                button._tooltip = null;
            }
        });
    }

    _onEmojiClicked(emoji) {
        // Record usage
        this._emojiManager.recordUsage(emoji.emoji);

        // Emit signal with emoji character (with skin tone applied)
        const emojiChar = this._emojiManager.getEmojiWithSkinTone(emoji.emoji, this._skinTone);
        this.emit('emoji-selected', emojiChar, emoji.name);

        // Visual feedback
        const button = this._emojiButtons.get(emoji.emoji);
        if (button) {
            button.add_style_class_name('betterkeys-emoji-button-selected');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
                button.remove_style_class_name('betterkeys-emoji-button-selected');
                return false;
            });
        }

        // Auto-hide after selection if configured
        if (this._settings && this._settings.get_boolean('emoji-auto-hide')) {
            this.hide();
        }
    }

    _showRecentlyUsed() {
        this._selectCategory('recently-used');
    }

    _onKeyPress(event) {
        const keyval = event.get_key_symbol();

        switch (keyval) {
            case Clutter.Escape:
                this.hide();
                return Clutter.EVENT_STOP;

            case Clutter.ArrowLeft:
                this._navigateCategory(-1);
                return Clutter.EVENT_STOP;

            case Clutter.ArrowRight:
                this._navigateCategory(1);
                return Clutter.EVENT_STOP;

            case Clutter.ArrowUp:
                this._navigateEmoji(-this._emojiPerRow);
                return Clutter.EVENT_STOP;

            case Clutter.ArrowDown:
                this._navigateEmoji(this._emojiPerRow);
                return Clutter.EVENT_STOP;

            case Clutter.Return:
            case Clutter.KP_Enter:
                // Trigger selected emoji
                // TODO: Implement emoji selection via keyboard
                return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _navigateCategory(direction) {
        const categories = this._categories;
        if (categories.length === 0) return;

        let currentIndex = categories.indexOf(this._currentCategory);
        if (currentIndex === -1) currentIndex = 0;

        const newIndex = (currentIndex + direction + categories.length) % categories.length;
        this._selectCategory(categories[newIndex]);
    }

    _navigateEmoji(offset) {
        // TODO: Implement keyboard navigation within emoji grid
        log(`[betterKeys] Would navigate emoji by ${offset}`);
    }

    /**
     * Show the emoji panel at the specified position.
     * @param {number} x - Screen X coordinate.
     * @param {number} y - Screen Y coordinate.
     */
    showAt(x, y) {
        if (this._isVisible) {
            return;
        }

        // Add to stage if not already
        if (!this.get_parent()) {
            Main.uiGroup.add_child(this);
        }

        // Update panel size from settings
        this._updatePanelSize();

        // Position panel (ensure it stays on screen)
        const [screenWidth, screenHeight] = global.stage.get_size();
        const panelWidth = this.width;
        const panelHeight = this.height;

        let finalX = x;
        let finalY = y;

        // Adjust if panel would go off screen
        if (finalX + panelWidth > screenWidth) {
            finalX = screenWidth - panelWidth - 10;
        }
        if (finalY + panelHeight > screenHeight) {
            finalY = screenHeight - panelHeight - 10;
        }
        if (finalX < 10) {
            finalX = 10;
        }
        if (finalY < 10) {
            finalY = 10;
        }

        this.set_position(finalX, finalY);
        this.show();
        this._isVisible = true;

        // Focus search entry
        this._searchEntry.grab_key_focus();

        // Refresh emojis to ensure up-to-date
        this._refreshEmojis();

        this.emit('shown');
        log('[betterKeys] EmojiPanel shown');
    }

    /**
     * Show the emoji panel at a default position (near keyboard).
     */
    show() {
        const [screenWidth, screenHeight] = global.stage.get_size();
        const defaultX = Math.floor((screenWidth - this._panelWidth) / 2);
        const defaultY = screenHeight - this._panelHeight - 100; // Above keyboard

        this.showAt(defaultX, defaultY);
    }

    /**
     * Hide the emoji panel.
     */
    hide() {
        if (!this._isVisible) {
            return;
        }

        this._isVisible = false;
        this.hide();

        // Clear search
        this._searchQuery = '';
        this._searchEntry.set_text('');

        this.emit('hidden');
        log('[betterKeys] EmojiPanel hidden');
    }

    /**
     * Toggle visibility of the emoji panel.
     * @param {number} x - Optional X coordinate.
     * @param {number} y - Optional Y coordinate.
     */
    toggle(x, y) {
        if (this._isVisible) {
            this.hide();
        } else if (x !== undefined && y !== undefined) {
            this.showAt(x, y);
        } else {
            this.show();
        }
    }

    /**
     * Check if panel is visible.
     * @returns {boolean} True if visible.
     */
    isVisible() {
        return this._isVisible;
    }

    /**
     * Update emoji manager reference.
     * @param {EmojiManager} emojiManager - New emoji manager.
     */
    setEmojiManager(emojiManager) {
        this._emojiManager = emojiManager;
        this._refreshCategories();
        this._refreshEmojis();
    }

    /**
     * Update settings manager reference.
     * @param {SettingsManager} settingsManager - New settings manager.
     */
    setSettingsManager(settingsManager) {
        this._settings = settingsManager;
        this._updatePanelSize();
    }

    /**
     * Get panel statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        const emojiCount = this._emojiButtons.size;
        const categoryCount = this._categories.length;

        return {
            visible: this._isVisible,
            currentCategory: this._currentCategory,
            emojiCount: emojiCount,
            categoryCount: categoryCount,
            searchQuery: this._searchQuery,
            skinTone: this._skinTone,
            panelWidth: this._panelWidth,
            panelHeight: this._panelHeight
        };
    }

    /**
     * Destroy the emoji panel.
     */
    destroy() {
        this._hideEmojiTooltip();
        this._emojiButtons.forEach(button => button.destroy());
        this._emojiButtons.clear();
        this._categoryButtons.clear();

        if (this.get_parent()) {
            this.get_parent().remove_child(this);
        }

        super.destroy();
        log('[betterKeys] EmojiPanel destroyed');
    }
});

// Add signals to the class
EmojiPanel.signals = {
    'emoji-selected': { param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING] },
    'shown': { param_types: [] },
    'hidden': { param_types: [] }
};
