/* src/ui/suggestion-bar.js - Suggestion bar UI for word predictions */

const { GObject, St, Clutter, Pango } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

/**
 * SuggestionBar - Displays word suggestions above the keyboard
 */
const SuggestionBar = GObject.registerClass(
class SuggestionBar extends St.BoxLayout {
    _init(predictor, settingsManager) {
        super._init({
            style_class: 'betterkeys-suggestion-bar',
            vertical: false,
            reactive: true,
            can_focus: true
        });

        this._predictor = predictor;
        this._settings = settingsManager;

        // Configuration
        this._config = {
            maxSuggestions: 5,
            showConfidence: false,
            animationDuration: 150,
            barPosition: 'top', // 'top' or 'bottom'
            tapToSelect: true,
            swipeToNavigate: true,
            showRanking: false
        };

        // State
        this._suggestions = [];
        this._selectedIndex = -1;
        this._visible = false;
        this._container = null;
        this._suggestionButtons = [];
        this._currentPrefix = '';

        // Create UI
        this._buildUI();

        // Connect signals
        this._connectSignals();

        log('[BetterKeys] SuggestionBar initialized');
    }

    /**
     * Build the suggestion bar UI.
     */
    _buildUI() {
        // Clear existing children
        this.remove_all_children();

        // Create container for suggestions
        this._container = new St.BoxLayout({
            style_class: 'betterkeys-suggestion-container',
            vertical: false,
            x_expand: true,
            y_expand: true
        });

        // Create suggestion buttons
        this._suggestionButtons = [];
        for (let i = 0; i < this._config.maxSuggestions; i++) {
            const button = this._createSuggestionButton(i);
            this._suggestionButtons.push(button);
            this._container.add_child(button);
        }

        this.add_child(this._container);

        // Apply initial styling
        this._updateStyle();
    }

    /**
     * Create a suggestion button.
     * @param {number} index - Button index.
     * @returns {St.Button} Button widget.
     */
    _createSuggestionButton(index) {
        const button = new St.Button({
            style_class: 'betterkeys-suggestion-button',
            reactive: true,
            can_focus: true,
            track_hover: true,
            label: ''
        });

        // Create label with word and confidence
        const labelBox = new St.BoxLayout({
            vertical: true,
            style_class: 'betterkeys-suggestion-label-box'
        });

        const wordLabel = new St.Label({
            style_class: 'betterkeys-suggestion-word',
            text: ''
        });

        const confidenceLabel = new St.Label({
            style_class: 'betterkeys-suggestion-confidence',
            text: ''
        });

        labelBox.add_child(wordLabel);
        if (this._config.showConfidence) {
            labelBox.add_child(confidenceLabel);
        }

        button.set_child(labelBox);

        // Store references
        button._wordLabel = wordLabel;
        button._confidenceLabel = confidenceLabel;
        button._index = index;

        // Connect signals
        button.connect('clicked', () => {
            this._onSuggestionClicked(index);
        });

        button.connect('enter-event', () => {
            this._onSuggestionHoverEnter(index);
            return false;
        });

        button.connect('leave-event', () => {
            this._onSuggestionHoverLeave(index);
            return false;
        });

        return button;
    }

    /**
     * Connect to predictor and settings signals.
     */
    _connectSignals() {
        // Connect to predictor updates
        if (this._predictor) {
            this._predictor.connect('suggestion-updated', () => {
                this._updateSuggestions();
            });
        }

        // Connect to settings changes
        if (this._settings) {
            this._settings.connect('changed', (settings, key) => {
                if (key.startsWith('suggestion-')) {
                    this._updateConfigFromSettings();
                }
            });
        }
    }

    /**
     * Update configuration from settings.
     */
    _updateConfigFromSettings() {
        if (!this._settings) {
            return;
        }

        const newConfig = {
            maxSuggestions: this._settings.get_int('suggestion-count') || 5,
            showConfidence: this._settings.get_boolean('show-confidence') || false,
            barPosition: this._settings.get_string('suggestion-position') || 'top',
            tapToSelect: this._settings.get_boolean('tap-to-select') || true,
            swipeToNavigate: this._settings.get_boolean('swipe-navigate') || true,
            showRanking: this._settings.get_boolean('show-ranking') || false
        };

        // Check if maxSuggestions changed
        if (newConfig.maxSuggestions !== this._config.maxSuggestions) {
            this._config.maxSuggestions = newConfig.maxSuggestions;
            this._rebuildUI();
        }

        // Update other config
        Object.assign(this._config, newConfig);

        // Update UI
        this._updateStyle();
        this._updateSuggestions();
    }

    /**
     * Rebuild UI when configuration changes.
     */
    _rebuildUI() {
        this._buildUI();
        this._updateSuggestions();
    }

    /**
     * Update suggestion bar style.
     */
    _updateStyle() {
        // Update position class
        this.remove_style_class_name('betterkeys-suggestion-bar-top');
        this.remove_style_class_name('betterkeys-suggestion-bar-bottom');
        this.add_style_class_name(`betterkeys-suggestion-bar-${this._config.barPosition}`);

        // Update button styles
        this._suggestionButtons.forEach(button => {
            if (this._config.showConfidence) {
                button._confidenceLabel.show();
            } else {
                button._confidenceLabel.hide();
            }
        });
    }

    /**
     * Update suggestions from predictor.
     * @param {string} prefix - Current prefix.
     */
    updateSuggestions(prefix = '') {
        this._currentPrefix = prefix;

        if (!this._predictor || !prefix || prefix.length < 1) {
            this._suggestions = [];
            this._updateUI();
            return;
        }

        // Get suggestions from predictor
        const suggestions = this._predictor.getSuggestions(prefix, this._config.maxSuggestions);
        this._suggestions = suggestions || [];

        // Update UI
        this._updateUI();
    }

    /**
     * Update UI with current suggestions.
     */
    _updateUI() {
        // Clear all buttons
        this._suggestionButtons.forEach((button, index) => {
            if (index < this._suggestions.length) {
                const suggestion = this._suggestions[index];
                this._updateButton(button, suggestion, index);
                button.show();
            } else {
                button._wordLabel.text = '';
                button._confidenceLabel.text = '';
                button.hide();
            }
        });

        // Update selected index
        this._selectedIndex = -1;

        // Show/hide bar
        if (this._suggestions.length > 0) {
            this.show();
            this._visible = true;
        } else {
            this.hide();
            this._visible = false;
        }
    }

    /**
     * Update a button with suggestion data.
     * @param {St.Button} button - Button to update.
     * @param {Object} suggestion - Suggestion data.
     * @param {number} index - Suggestion index.
     */
    _updateButton(button, suggestion, index) {
        const word = suggestion.word || '';
        const confidence = suggestion.confidence || 0;
        const type = suggestion.type || 'completion';

        // Update labels
        button._wordLabel.text = word;

        if (this._config.showConfidence) {
            const confidencePercent = Math.round(confidence * 100);
            button._confidenceLabel.text = `${confidencePercent}%`;
        }

        // Update styling based on type
        button.remove_style_class_name('betterkeys-suggestion-type-completion');
        button.remove_style_class_name('betterkeys-suggestion-type-context');
        button.remove_style_class_name('betterkeys-suggestion-type-ml');
        button.remove_style_class_name('betterkeys-suggestion-type-statistical');

        button.add_style_class_name(`betterkeys-suggestion-type-${type}`);

        // Add ranking indicator
        if (this._config.showRanking) {
            button.remove_style_class_name('betterkeys-suggestion-rank-1');
            button.remove_style_class_name('betterkeys-suggestion-rank-2');
            button.remove_style_class_name('betterkeys-suggestion-rank-3');

            if (index < 3) {
                button.add_style_class_name(`betterkeys-suggestion-rank-${index + 1}`);
            }
        }

        // Store suggestion data
        button._suggestion = suggestion;
    }

    /**
     * Handle suggestion click.
     * @param {number} index - Clicked suggestion index.
     */
    _onSuggestionClicked(index) {
        if (index < 0 || index >= this._suggestions.length) {
            return;
        }

        const suggestion = this._suggestions[index];
        this.emit('suggestion-selected', suggestion.word, index);

        // Animate selection
        this._animateSelection(index);

        log(`[BetterKeys] Suggestion selected: ${suggestion.word}`);
    }

    /**
     * Handle suggestion hover enter.
     * @param {number} index - Hovered suggestion index.
     */
    _onSuggestionHoverEnter(index) {
        if (index < 0 || index >= this._suggestions.length) {
            return;
        }

        this._suggestionButtons[index].add_style_class_name('betterkeys-suggestion-hover');
    }

    /**
     * Handle suggestion hover leave.
     * @param {number} index - Hovered suggestion index.
     */
    _onSuggestionHoverLeave(index) {
        if (index < 0 || index >= this._suggestions.length) {
            return;
        }

        this._suggestionButtons[index].remove_style_class_name('betterkeys-suggestion-hover');
    }

    /**
     * Animate selection feedback.
     * @param {number} index - Selected index.
     */
    _animateSelection(index) {
        const button = this._suggestionButtons[index];
        if (!button) {
            return;
        }

        // Add selection class
        button.add_style_class_name('betterkeys-suggestion-selected');

        // Remove after animation
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._config.animationDuration, () => {
            button.remove_style_class_name('betterkeys-suggestion-selected');
            return false;
        });
    }

    /**
     * Select next suggestion.
     */
    selectNext() {
        if (this._suggestions.length === 0) {
            return;
        }

        const newIndex = (this._selectedIndex + 1) % this._suggestions.length;
        this._selectSuggestion(newIndex);
    }

    /**
     * Select previous suggestion.
     */
    selectPrevious() {
        if (this._suggestions.length === 0) {
            return;
        }

        const newIndex = this._selectedIndex <= 0 ?
            this._suggestions.length - 1 :
            this._selectedIndex - 1;
        this._selectSuggestion(newIndex);
    }

    /**
     * Select a suggestion by index.
     * @param {number} index - Suggestion index.
     */
    _selectSuggestion(index) {
        if (index < 0 || index >= this._suggestions.length) {
            return;
        }

        // Clear previous selection
        if (this._selectedIndex >= 0 && this._selectedIndex < this._suggestions.length) {
            this._suggestionButtons[this._selectedIndex].remove_style_class_name('betterkeys-suggestion-active');
        }

        // Set new selection
        this._selectedIndex = index;
        this._suggestionButtons[index].add_style_class_name('betterkeys-suggestion-active');

        // Scroll into view if needed
        this._ensureVisible(index);
    }

    /**
     * Ensure suggestion is visible.
     * @param {number} index - Suggestion index.
     */
    _ensureVisible(index) {
        // Implementation would depend on scrollable container
        // For now, just log
        log(`[BetterKeys] Ensuring suggestion ${index} is visible`);
    }

    /**
     * Get selected suggestion.
     * @returns {Object|null} Selected suggestion.
     */
    getSelectedSuggestion() {
        if (this._selectedIndex >= 0 && this._selectedIndex < this._suggestions.length) {
            return this._suggestions[this._selectedIndex];
        }
        return null;
    }

    /**
     * Clear all suggestions.
     */
    clear() {
        this._suggestions = [];
        this._selectedIndex = -1;
        this._currentPrefix = '';
        this._updateUI();
    }

    /**
     * Show the suggestion bar.
     */
    showBar() {
        if (this._suggestions.length > 0) {
            this.show();
            this._visible = true;
        }
    }

    /**
     * Hide the suggestion bar.
     */
    hideBar() {
        this.hide();
        this._visible = false;
    }

    /**
     * Check if suggestion bar is visible.
     * @returns {boolean} True if visible.
     */
    isVisible() {
        return this._visible;
    }

    /**
     * Get suggestion bar statistics.
     * @returns {Object} Statistics.
     */
    getStats() {
        return {
            visible: this._visible,
            suggestionCount: this._suggestions.length,
            selectedIndex: this._selectedIndex,
            currentPrefix: this._currentPrefix,
            config: { ...this._config }
        };
    }

    /**
     * Update configuration.
     * @param {Object} config - New configuration.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        this._updateStyle();
        this._updateUI();
        log('[BetterKeys] SuggestionBar configuration updated');
    }

    /**
     * Get current configuration.
     * @returns {Object} Configuration.
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Destroy the suggestion bar.
     */
    destroy() {
        this._suggestionButtons.forEach(button => {
            button.destroy();
        });
        this._suggestionButtons = [];
        this._container = null;
        this._suggestions = [];

        super.destroy();
        log('[BetterKeys] SuggestionBar destroyed');
    }
});

// Add signals
SuggestionBar.signals = {
    'suggestion-selected': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT] },
    'suggestion-hovered': { param_types: [GObject.TYPE_STRING, GObject.TYPE_INT] },
    'visibility-changed': { param_types: [GObject.TYPE_BOOLEAN] }
};

// Export
var SuggestionBar = SuggestionBar;
