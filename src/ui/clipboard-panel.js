/* src/ui/clipboard-panel.js - Floating clipboard history panel */

const { GObject, St, Clutter, Pango, Gtk, Gdk } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ClipboardPanel = GObject.registerClass(
class ClipboardPanel extends St.BoxLayout {
    _init(clipboardManager, settingsManager) {
        super._init({
            style_class: 'betterkeys-clipboard-panel',
            vertical: true,
            reactive: true,
            can_focus: true,
            visible: false
        });

        this._clipboardManager = clipboardManager;
        this._settings = settingsManager;
        this._isVisible = false;
        this._items = [];
        this._itemWidgets = new Map(); // id -> widget
        this._searchQuery = '';
        this._selectedItemId = null;
        this._panelWidth = 400;
        this._panelHeight = 500;
        this._maxVisibleItems = 10;
        this._itemHeight = 60;

        // UI components
        this._header = null;
        this._searchEntry = null;
        this._scrollView = null;
        this._itemsContainer = null;
        this._footer = null;
        this._clearButton = null;
        this._closeButton = null;

        // Build UI
        this._buildUI();

        // Connect signals
        this._connectSignals();

        // Load initial items
        this._refreshItems();

        log('[betterKeys] ClipboardPanel initialized');
    }

    _buildUI() {
        this.remove_all_children();

        // Header with title and search
        this._header = new St.BoxLayout({
            style_class: 'betterkeys-clipboard-header',
            vertical: false,
            x_expand: true
        });

        const title = new St.Label({
            style_class: 'betterkeys-clipboard-title',
            text: _('Clipboard History'),
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        this._closeButton = new St.Button({
            style_class: 'betterkeys-clipboard-close-button',
            reactive: true,
            can_focus: true,
            label: '×'
        });
        this._closeButton.connect('clicked', () => this.hide());

        this._header.add_child(title);
        this._header.add_child(this._closeButton);

        // Search entry
        this._searchEntry = new St.Entry({
            style_class: 'betterkeys-clipboard-search',
            hint_text: _('Search clipboard history...'),
            x_expand: true,
            can_focus: true
        });
        this._searchEntry.connect('text-changed', () => {
            this._searchQuery = this._searchEntry.get_text();
            this._refreshItems();
        });

        // Scrollable items container
        this._scrollView = new St.ScrollView({
            style_class: 'betterkeys-clipboard-scroll',
            x_expand: true,
            y_expand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
        });

        this._itemsContainer = new St.BoxLayout({
            style_class: 'betterkeys-clipboard-items-container',
            vertical: true,
            x_expand: true
        });

        this._scrollView.add_actor(this._itemsContainer);

        // Footer with clear button and stats
        this._footer = new St.BoxLayout({
            style_class: 'betterkeys-clipboard-footer',
            vertical: false,
            x_expand: true
        });

        this._clearButton = new St.Button({
            style_class: 'betterkeys-clipboard-clear-button',
            reactive: true,
            can_focus: true,
            label: _('Clear All')
        });
        this._clearButton.connect('clicked', () => this._onClearClicked());

        const statsLabel = new St.Label({
            style_class: 'betterkeys-clipboard-stats',
            text: '',
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });
        this._statsLabel = statsLabel;

        this._footer.add_child(this._clearButton);
        this._footer.add_child(statsLabel);

        // Assemble panel
        this.add_child(this._header);
        this.add_child(this._searchEntry);
        this.add_child(this._scrollView);
        this.add_child(this._footer);

        // Set initial size
        this.width = this._panelWidth;
        this.height = this._panelHeight;
    }

    _connectSignals() {
        // Connect to clipboard manager events
        if (this._clipboardManager) {
            this._clipboardManager.connect('item-added', () => this._refreshItems());
            this._clipboardManager.connect('item-removed', () => this._refreshItems());
            this._clipboardManager.connect('history-cleared', () => this._refreshItems());
        }

        // Connect to settings changes
        if (this._settings) {
            this._settings.connect('changed', (settings, key) => {
                if (key === 'clipboard-max-items' || key === 'clipboard-panel-size') {
                    this._updatePanelSize();
                }
            });
        }

        // Connect key events for navigation
        this.connect('key-press-event', (actor, event) => this._onKeyPress(event));
    }

    _updatePanelSize() {
        // Update panel dimensions based on settings
        const maxItems = this._settings ? this._settings.get_int('clipboard-max-items') : 10;
        this._maxVisibleItems = Math.max(5, Math.min(20, maxItems));

        const size = this._settings ? this._settings.get_string('clipboard-panel-size') : 'medium';
        let width, height;
        switch (size) {
            case 'small':
                width = 300;
                height = 400;
                break;
            case 'large':
                width = 500;
                height = 600;
                break;
            case 'medium':
            default:
                width = 400;
                height = 500;
        }

        this._panelWidth = width;
        this._panelHeight = height;

        this.width = width;
        this.height = height;

        // Update item height based on size
        this._itemHeight = size === 'small' ? 50 : size === 'large' ? 70 : 60;

        // Refresh items to apply new sizing
        this._refreshItems();
    }

    _refreshItems() {
        // Clear existing item widgets
        this._itemWidgets.forEach(widget => widget.destroy());
        this._itemWidgets.clear();
        this._itemsContainer.remove_all_children();

        // Get items from clipboard manager
        this._items = this._clipboardManager ?
            this._clipboardManager.getHistory(0, this._searchQuery) : [];

        // Limit visible items
        const visibleItems = this._items.slice(0, this._maxVisibleItems);

        // Create item widgets
        visibleItems.forEach((item, index) => {
            const widget = this._createItemWidget(item, index);
            this._itemsContainer.add_child(widget);
            this._itemWidgets.set(item.id, widget);
        });

        // Update stats
        this._updateStats();

        // If no items, show placeholder
        if (visibleItems.length === 0) {
            const placeholder = new St.Label({
                style_class: 'betterkeys-clipboard-placeholder',
                text: this._searchQuery ?
                    _('No matching clipboard items') :
                    _('Clipboard history is empty'),
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER
            });
            this._itemsContainer.add_child(placeholder);
        }
    }

    _createItemWidget(item, index) {
        const itemWidget = new St.BoxLayout({
            style_class: 'betterkeys-clipboard-item',
            vertical: false,
            reactive: true,
            can_focus: true,
            track_hover: true,
            height: this._itemHeight
        });

        // Store item reference
        itemWidget._item = item;

        // Preview text
        const preview = new St.Label({
            style_class: 'betterkeys-clipboard-item-preview',
            text: item.preview || this._truncateText(item.text, 80),
            x_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
            ellipsize: Pango.EllipsizeMode.END
        });

        // Timestamp
        const timestamp = new St.Label({
            style_class: 'betterkeys-clipboard-item-timestamp',
            text: this._formatTimestamp(item.timestamp),
            y_align: Clutter.ActorAlign.CENTER
        });

        // Actions container
        const actions = new St.BoxLayout({
            style_class: 'betterkeys-clipboard-item-actions',
            vertical: false
        });

        const copyButton = new St.Button({
            style_class: 'betterkeys-clipboard-item-copy',
            reactive: true,
            can_focus: false,
            label: _('Copy')
        });
        copyButton.connect('clicked', () => this._onCopyClicked(item.id));

        const deleteButton = new St.Button({
            style_class: 'betterkeys-clipboard-item-delete',
            reactive: true,
            can_focus: false,
            label: '×'
        });
        deleteButton.connect('clicked', () => this._onDeleteClicked(item.id));

        actions.add_child(copyButton);
        actions.add_child(deleteButton);

        itemWidget.add_child(preview);
        itemWidget.add_child(timestamp);
        itemWidget.add_child(actions);

        // Connect item click
        itemWidget.connect('button-press-event', () => {
            this._onItemClicked(item.id);
            return Clutter.EVENT_STOP;
        });

        // Connect hover events
        itemWidget.connect('enter-event', () => {
            itemWidget.add_style_class_name('betterkeys-clipboard-item-hover');
            return false;
        });

        itemWidget.connect('leave-event', () => {
            itemWidget.remove_style_class_name('betterkeys-clipboard-item-hover');
            return false;
        });

        return itemWidget;
    }

    _truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - 3) + '...';
    }

    _formatTimestamp(timestamp) {
        if (!timestamp) return '';

        const now = Date.now();
        const diff = now - timestamp;

        // Less than a minute
        if (diff < 60 * 1000) {
            return _('Just now');
        }

        // Less than an hour
        if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return ngettext('%d minute ago', '%d minutes ago', minutes).format(minutes);
        }

        // Less than a day
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return ngettext('%d hour ago', '%d hours ago', hours).format(hours);
        }

        // Days
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return ngettext('%d day ago', '%d days ago', days).format(days);
    }

    _updateStats() {
        if (!this._statsLabel) return;

        const total = this._items.length;
        const visible = Math.min(total, this._maxVisibleItems);

        let statsText = '';
        if (this._searchQuery) {
            statsText = ngettext(
                '%d item (filtered)',
                '%d items (filtered)',
                visible
            ).format(visible);
        } else {
            statsText = ngettext(
                '%d item',
                '%d items',
                total
            ).format(total);
        }

        this._statsLabel.text = statsText;
    }

    _onItemClicked(itemId) {
        this._selectItem(itemId);
        this._clipboardManager.copyToClipboard(itemId);
        this.emit('item-selected', itemId);

        // Auto-hide after selection if configured
        if (this._settings && this._settings.get_boolean('clipboard-auto-hide')) {
            this.hide();
        }
    }

    _onCopyClicked(itemId) {
        this._clipboardManager.copyToClipboard(itemId);
        this.emit('item-copied', itemId);

        // Visual feedback
        const widget = this._itemWidgets.get(itemId);
        if (widget) {
            widget.add_style_class_name('betterkeys-clipboard-item-copied');
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                widget.remove_style_class_name('betterkeys-clipboard-item-copied');
                return false;
            });
        }
    }

    _onDeleteClicked(itemId) {
        this._clipboardManager.removeItem(itemId);
        this.emit('item-deleted', itemId);
    }

    _onClearClicked() {
        // Show confirmation dialog
        const dialog = new Gtk.MessageDialog({
            transient_for: null,
            modal: true,
            message_type: Gtk.MessageType.WARNING,
            buttons: Gtk.ButtonsType.YES_NO,
            text: _('Clear Clipboard History'),
            secondary_text: _('Are you sure you want to clear all clipboard history? This action cannot be undone.')
        });

        dialog.connect('response', (dialog, responseId) => {
            if (responseId === Gtk.ResponseType.YES) {
                this._clipboardManager.clearHistory();
                this.emit('history-cleared');
            }
            dialog.destroy();
        });

        dialog.show();
    }

    _selectItem(itemId) {
        // Deselect previous
        if (this._selectedItemId && this._itemWidgets.has(this._selectedItemId)) {
            const prevWidget = this._itemWidgets.get(this._selectedItemId);
            prevWidget.remove_style_class_name('betterkeys-clipboard-item-selected');
        }

        // Select new
        this._selectedItemId = itemId;
        const widget = this._itemWidgets.get(itemId);
        if (widget) {
            widget.add_style_class_name('betterkeys-clipboard-item-selected');

            // Ensure item is visible in scroll view
            this._ensureVisible(widget);
        }
    }

    _ensureVisible(widget) {
        // Calculate widget position relative to scroll view
        const [widgetX, widgetY] = widget.get_transformed_position();
        const [scrollX, scrollY] = this._scrollView.get_transformed_position();

        const widgetTop = widgetY - scrollY;
        const widgetBottom = widgetTop + widget.height;
        const scrollHeight = this._scrollView.height;

        // If widget is outside viewport, adjust scroll
        if (widgetTop < 0) {
            // Widget above viewport
            this._scrollView.vscroll.adjustment.value = widgetY - scrollY;
        } else if (widgetBottom > scrollHeight) {
            // Widget below viewport
            this._scrollView.vscroll.adjustment.value = widgetBottom - scrollHeight;
        }
    }

    _onKeyPress(event) {
        const keyval = event.get_key_symbol();

        switch (keyval) {
            case Clutter.Escape:
                this.hide();
                return Clutter.EVENT_STOP;

            case Clutter.ArrowUp:
                this._navigate(-1);
                return Clutter.EVENT_STOP;

            case Clutter.ArrowDown:
                this._navigate(1);
                return Clutter.EVENT_STOP;

            case Clutter.Return:
            case Clutter.KP_Enter:
                if (this._selectedItemId) {
                    this._onItemClicked(this._selectedItemId);
                }
                return Clutter.EVENT_STOP;

            case Clutter.Delete:
                if (this._selectedItemId) {
                    this._onDeleteClicked(this._selectedItemId);
                }
                return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _navigate(direction) {
        const items = Array.from(this._itemWidgets.keys());
        if (items.length === 0) return;

        let currentIndex = items.indexOf(this._selectedItemId);
        if (currentIndex === -1) {
            currentIndex = direction > 0 ? -1 : items.length;
        }

        const newIndex = (currentIndex + direction + items.length) % items.length;
        this._selectItem(items[newIndex]);
    }

    /**
     * Show the clipboard panel at the specified position.
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

        // Refresh items to ensure up-to-date
        this._refreshItems();

        this.emit('shown');
        log('[betterKeys] ClipboardPanel shown');
    }

    /**
     * Show the clipboard panel at a default position (near keyboard).
     */
    show() {
        const [screenWidth, screenHeight] = global.stage.get_size();
        const defaultX = Math.floor((screenWidth - this._panelWidth) / 2);
        const defaultY = screenHeight - this._panelHeight - 100; // Above keyboard

        this.showAt(defaultX, defaultY);
    }

    /**
     * Hide the clipboard panel.
     */
    hide() {
        if (!this._isVisible) {
            return;
        }

        this._isVisible = false;
        this.hide();

        this.emit('hidden');
        log('[betterKeys] ClipboardPanel hidden');
    }

    /**
     * Toggle visibility of the clipboard panel.
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
     * Update clipboard manager reference.
     * @param {ClipboardHistoryManager} clipboardManager - New clipboard manager.
     */
    setClipboardManager(clipboardManager) {
        this._clipboardManager = clipboardManager;
        this._refreshItems();
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
        return {
            visible: this._isVisible,
            itemCount: this._items.length,
            visibleItems: Math.min(this._items.length, this._maxVisibleItems),
            searchQuery: this._searchQuery,
            selectedItemId: this._selectedItemId,
            panelWidth: this._panelWidth,
            panelHeight: this._panelHeight
        };
    }

    /**
     * Destroy the clipboard panel.
     */
    destroy() {
        this._itemWidgets.forEach(widget => widget.destroy());
        this._itemWidgets.clear();

        if (this.get_parent()) {
            this.get_parent().remove_child(this);
        }

        super.destroy();
        log('[betterKeys] ClipboardPanel destroyed');
    }
});

// Add signals to the class
ClipboardPanel.signals = {
    'item-selected': { param_types: [GObject.TYPE_STRING] },
    'item-copied': { param_types: [GObject.TYPE_STRING] },
    'item-deleted': { param_types: [GObject.TYPE_STRING] },
    'history-cleared': { param_types: [] },
    'shown': { param_types: [] },
    'hidden': { param_types: [] }
};
