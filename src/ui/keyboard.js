/* src/ui/keyboard.js - Main keyboard UI component */

const { GObject, St, Clutter, Gio, Shell, GLib } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Key = Me.imports.src.ui.key.Key;
const LayoutManager = Me.imports.src.keyboard.layout_manager.LayoutManager;
const LayoutAdapter = Me.imports.src.keyboard.layout_adapter.LayoutAdapter;
const SuggestionBar = Me.imports.src.ui['suggestion-bar'].SuggestionBar;

const BetterKeysKeyboardUI = GObject.registerClass(
class BetterKeysKeyboardUI extends St.Widget {
    _init(settingsManager) {
        super._init({
            reactive: true,
            can_focus: true,
            style_class: 'betterkeys-keyboard',
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                spacing: 4
            })
        });
        
        this._settings = settingsManager;
        this._keys = [];
        this._rows = [];
        this._isVisible = false;
        this._currentLayout = 'en_US_qwerty';
        this._layoutDefinition = null;
        this._dockingPosition = 'bottom'; // 'top', 'bottom', 'left', 'right', 'floating'
        this._keyboardSize = 'normal'; // 'compact', 'normal', 'large'
        this._dragHandle = null;
        this._isDragging = false;
        this._dragStartX = 0;
        this._dragStartY = 0;
        this._animationTimeoutId = 0;
        this._keyPressAnimations = new Map();
        this._windowManager = null; // optional window manager
        
        // Layout switching components
        this._layoutManager = new LayoutManager();
        this._layoutAdapter = new LayoutAdapter(this._settings);
        this._layoutIndicator = null;
        this._layoutSwitcher = null;
        this._layoutHistory = [];
        this._maxLayoutHistory = 5;
        this._layoutTransitionDuration = 300;
        
        // Suggestion bar
        this._suggestionBar = null;
        
        // Load the default layout
        this._loadLayout(this._currentLayout);
        
        // Create the keyboard container
        this._createKeyboard();
        
        // Create drag handle for floating mode
        this._createDragHandle();
        
        // Create layout indicator and switcher
        this._createLayoutUI();
        
        // Apply size settings
        this._applySize();
        
        // Connect to layout adapter events
        this._layoutAdapter.connect('layout-changed', this._onLayoutChanged.bind(this));
        
        log('[BetterKeys] KeyboardUI initialized with layout switching');
    }
    
    _createDragHandle() {
        this._dragHandle = new St.Widget({
            reactive: true,
            can_focus: false,
            style_class: 'betterkeys-drag-handle',
            width: 40,
            height: 8,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START
        });
        
        // Connect drag events
        this._dragHandle.connect('button-press-event', this._onDragStart.bind(this));
        this._dragHandle.connect('button-release-event', this._onDragEnd.bind(this));
        this._dragHandle.connect('motion-event', this._onDragMove.bind(this));
        
        // Initially hidden (only shown in floating mode)
        this._dragHandle.hide();
        this.add_child(this._dragHandle);
    }
    
    /**
     * Create layout indicator and switcher UI.
     */
    _createLayoutUI() {
        // Layout indicator (shows current layout)
        this._layoutIndicator = new St.Button({
            style_class: 'betterkeys-layout-indicator',
            reactive: true,
            can_focus: true,
            label: 'QWERTY',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END
        });
        
        this._layoutIndicator.connect('clicked', this._showLayoutSwitcher.bind(this));
        this._layoutIndicator.connect('enter-event', this._onLayoutIndicatorHover.bind(this));
        this._layoutIndicator.connect('leave-event', this._onLayoutIndicatorLeave.bind(this));
        
        // Initially hidden, will be shown based on settings
        this._layoutIndicator.hide();
        this.add_child(this._layoutIndicator);
        
        // Layout switcher popup menu
        this._layoutSwitcher = new PopupMenu.PopupMenu(this._layoutIndicator, 0.0, 0.0, 0);
        this._layoutSwitcher.connect('open-state-changed', this._onLayoutSwitcherToggle.bind(this));
        
        // Update layout indicator text
        this._updateLayoutIndicator();
    }
    
    /**
     * Update layout indicator with current layout name.
     */
    _updateLayoutIndicator() {
        if (!this._layoutIndicator || !this._layoutDefinition) return;
        
        const layoutName = this._layoutDefinition.name || this._currentLayout;
        this._layoutIndicator.label = layoutName;
        
        // Show or hide based on settings
        const showIndicator = this._settings.getShowLayoutIndicator();
        if (showIndicator && this._isVisible) {
            this._layoutIndicator.show();
        } else {
            this._layoutIndicator.hide();
        }
    }
    
    /**
     * Handle layout indicator hover (show preview).
     */
    _onLayoutIndicatorHover() {
        if (!this._settings.getLayoutPreviewOnHover()) return;
        
        // Show a small preview of the layout
        // This could be a tooltip or a temporary overlay
        // For now, we'll just highlight the indicator
        this._layoutIndicator.add_style_class_name('betterkeys-layout-indicator-hover');
    }
    
    /**
     * Handle layout indicator leave.
     */
    _onLayoutIndicatorLeave() {
        this._layoutIndicator.remove_style_class_name('betterkeys-layout-indicator-hover');
    }
    
    /**
     * Show layout switcher popup menu.
     */
    _showLayoutSwitcher() {
        if (!this._layoutSwitcher) return;
        
        // Clear existing menu items
        this._layoutSwitcher.removeAll();
        
        // Get available layouts
        const layouts = this._layoutManager.getAvailableLayouts();
        
        // Add layout items
        layouts.forEach(layout => {
            const item = new PopupMenu.PopupMenuItem(layout.name);
            item.connect('activate', () => {
                this.switchLayout(layout.id);
                this._layoutSwitcher.close();
            });
            this._layoutSwitcher.addMenuItem(item);
        });
        
        // Add separator
        this._layoutSwitcher.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        
        // Add "Layout Settings" item
        const settingsItem = new PopupMenu.PopupMenuItem(_('Layout Settings'));
        settingsItem.connect('activate', () => {
            this._openLayoutSettings();
            this._layoutSwitcher.close();
        });
        this._layoutSwitcher.addMenuItem(settingsItem);
        
        // Open the menu
        this._layoutSwitcher.open(true);
    }
    
    /**
     * Handle layout switcher open/close state.
     */
    _onLayoutSwitcherToggle(menu, isOpen) {
        if (isOpen) {
            this._layoutIndicator.add_style_class_name('betterkeys-layout-indicator-active');
        } else {
            this._layoutIndicator.remove_style_class_name('betterkeys-layout-indicator-active');
        }
    }
    
    /**
     * Switch to a different layout with smooth transition.
     * @param {string} layoutId - Layout identifier.
     */
    switchLayout(layoutId) {
        if (layoutId === this._currentLayout) return;
        
        log(`[BetterKeys] Switching layout from ${this._currentLayout} to ${layoutId}`);
        
        // Add to layout history
        this._addToLayoutHistory(this._currentLayout);
        
        // Get layout definition
        const layout = this._layoutManager.getLayout(layoutId);
        if (!layout) {
            logError(`[BetterKeys] Layout not found: ${layoutId}`);
            return;
        }
        
        // Animate layout transition
        this._animateLayoutTransition(layout);
    }
    
    /**
     * Animate layout transition (fade out, change, fade in).
     * @param {Object} newLayout - New layout definition.
     */
    _animateLayoutTransition(newLayout) {
        const duration = this._layoutTransitionDuration;
        
        // Fade out current keyboard
        this.ease({
            opacity: 0,
            duration: duration / 2,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                // Change layout
                this.setLayout(newLayout);
                
                // Fade in new keyboard
                this.ease({
                    opacity: 255,
                    duration: duration / 2,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD
                });
                
                // Update current layout
                this._currentLayout = newLayout.id;
                this._updateLayoutIndicator();
                
                // Emit layout changed signal
                this.emit('layout-changed', newLayout.id);
                
                log(`[BetterKeys] Layout transition completed to ${newLayout.id}`);
            }
        });
    }
    
    /**
     * Add layout to history (for quick access).
     * @param {string} layoutId - Layout identifier.
     */
    _addToLayoutHistory(layoutId) {
        // Remove if already in history
        this._layoutHistory = this._layoutHistory.filter(id => id !== layoutId);
        
        // Add to front
        this._layoutHistory.unshift(layoutId);
        
        // Trim history
        if (this._layoutHistory.length > this._maxLayoutHistory) {
            this._layoutHistory.pop();
        }
    }
    
    /**
     * Get recent layouts for quick switching.
     * @returns {Array} Array of layout IDs.
     */
    getRecentLayouts() {
        return [...this._layoutHistory];
    }
    
    /**
     * Switch to next layout in rotation.
     */
    nextLayout() {
        const layouts = this._layoutManager.getAvailableLayouts();
        const currentIndex = layouts.findIndex(l => l.id === this._currentLayout);
        const nextIndex = (currentIndex + 1) % layouts.length;
        
        if (nextIndex !== currentIndex) {
            this.switchLayout(layouts[nextIndex].id);
        }
    }
    
    /**
     * Switch to previous layout in rotation.
     */
    previousLayout() {
        const layouts = this._layoutManager.getAvailableLayouts();
        const currentIndex = layouts.findIndex(l => l.id === this._currentLayout);
        const prevIndex = (currentIndex - 1 + layouts.length) % layouts.length;
        
        if (prevIndex !== currentIndex) {
            this.switchLayout(layouts[prevIndex].id);
        }
    }
    
    /**
     * Handle layout changed event from layout adapter.
     * @param {LayoutAdapter} adapter - The layout adapter.
     * @param {string} layoutId - New layout ID.
     */
    _onLayoutChanged(adapter, layoutId) {
        log(`[BetterKeys] Layout adapter requested switch to ${layoutId}`);
        this.switchLayout(layoutId);
    }
    
    /**
     * Open layout settings dialog.
     */
    _openLayoutSettings() {
        // This would open a settings dialog for layout customization
        // For now, just log
        log('[BetterKeys] Opening layout settings');
        // TODO: Implement layout settings UI
    }
    
    _onDragStart(actor, event) {
        if (this._dockingPosition !== 'floating') return Clutter.EVENT_PROPAGATE;
        
        this._isDragging = true;
        [this._dragStartX, this._dragStartY] = event.get_coords();
        this._dragStartX -= this.x;
        this._dragStartY -= this.y;
        
        this.add_style_class_name('betterkeys-keyboard-dragging');
        return Clutter.EVENT_STOP;
    }
    
    _onDragMove(actor, event) {
        if (!this._isDragging) return Clutter.EVENT_PROPAGATE;
        
        let [x, y] = event.get_coords();
        this.set_position(
            Math.max(0, x - this._dragStartX),
            Math.max(0, y - this._dragStartY)
        );
        return Clutter.EVENT_STOP;
    }
    
    _onDragEnd(actor, event) {
        if (!this._isDragging) return Clutter.EVENT_PROPAGATE;
        
        this._isDragging = false;
        this.remove_style_class_name('betterkeys-keyboard-dragging');
        return Clutter.EVENT_STOP;
    }
    
    _applySize() {
        // Remove existing size classes
        this.remove_style_class_name('betterkeys-size-compact');
        this.remove_style_class_name('betterkeys-size-normal');
        this.remove_style_class_name('betterkeys-size-large');
        
        // Add new size class
        this.add_style_class_name(`betterkeys-size-${this._keyboardSize}`);
        
        // Adjust key sizes if layout definition exists
        if (this._layoutDefinition) {
            let scale = 1.0;
            switch (this._keyboardSize) {
                case 'compact': scale = 0.8; break;
                case 'large': scale = 1.2; break;
                default: scale = 1.0;
            }
            this._keys.forEach(key => {
                key.width = this._layoutDefinition.keyWidth * scale;
                key.height = this._layoutDefinition.keyHeight * scale;
            });
        }
    }
    
    /**
     * Set docking position and update UI accordingly.
     * @param {string} position - One of 'top', 'bottom', 'left', 'right', 'floating'.
     */
    setDockingPosition(position) {
        const validPositions = ['top', 'bottom', 'left', 'right', 'floating'];
        if (!validPositions.includes(position)) {
            logError(`[BetterKeys] Invalid docking position: ${position}`);
            return;
        }
        
        this._dockingPosition = position;
        
        // Update drag handle visibility
        if (this._dragHandle) {
            if (position === 'floating') {
                this._dragHandle.show();
            } else {
                this._dragHandle.hide();
            }
        }
        
        // Update positioning
        this._updatePosition();
        log(`[BetterKeys] Docking position set to ${position}`);
    }
    
    /**
     * Set keyboard size and adjust UI.
     * @param {string} size - One of 'compact', 'normal', 'large'.
     */
    setKeyboardSize(size) {
        const validSizes = ['compact', 'normal', 'large'];
        if (!validSizes.includes(size)) {
            logError(`[BetterKeys] Invalid keyboard size: ${size}`);
            return;
        }
        
        this._keyboardSize = size;
        this._applySize();
        log(`[BetterKeys] Keyboard size set to ${size}`);
    }

    /**
     * Set the window manager that manages this keyboard's window.
     * @param {WindowManager} windowManager - The window manager instance.
     */
    setWindowManager(windowManager) {
        this._windowManager = windowManager;
        log('[BetterKeys] Window manager attached to keyboard UI');
    }

    /**
     * Attach a suggestion bar to the keyboard.
     * @param {SuggestionBar} suggestionBar - The suggestion bar instance.
     */
    setSuggestionBar(suggestionBar) {
        if (this._suggestionBar) {
            this._suggestionBar.destroy();
        }
        this._suggestionBar = suggestionBar;
        if (suggestionBar) {
            // Add suggestion bar as first child (above rows)
            this.insert_child_at_index(suggestionBar, 0);
            // Hide by default, will be shown when suggestions available
            suggestionBar.hide();
        }
        log('[BetterKeys] Suggestion bar attached to keyboard UI');
    }
    
    _loadLayout(layoutId) {
        // Use LayoutManager to load layout
        try {
            const layout = this._layoutManager.getLayout(layoutId);
            if (layout) {
                this._layoutDefinition = layout;
                log(`[BetterKeys] Loaded layout: ${layoutId}`);
            } else {
                logError(`[BetterKeys] Layout not found: ${layoutId}, using default`);
                this._loadDefaultLayout();
            }
        } catch (error) {
            logError(`[BetterKeys] Failed to load layout ${layoutId}: ${error}`);
            this._loadDefaultLayout();
        }
    }
    
    /**
     * Load a default QWERTY layout as fallback.
     */
    _loadDefaultLayout() {
        this._layoutDefinition = {
            id: 'en_US_qwerty',
            name: 'English (US) QWERTY',
            rows: [
                ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
                ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace'],
                ['?123', ',', 'Space', '.', 'Enter']
            ],
            keyWidth: 60,
            keyHeight: 60,
            spacing: 4
        };
    }
    
    /**
     * Set a new layout definition and recreate the keyboard.
     * @param {Object} layout - Layout object from LayoutManager.
     */
    setLayout(layout) {
        if (!layout || !layout.rows) {
            logError('[BetterKeys] Invalid layout provided to setLayout');
            return;
        }
        
        this._layoutDefinition = layout;
        this._currentLayout = layout.id;
        this._createKeyboard();
        log(`[BetterKeys] Keyboard layout changed to ${layout.id}`);
    }
    
    _createKeyboard() {
        // Clear any existing keys
        this._keys.forEach(key => key.destroy());
        this._keys = [];
        this._rows = [];
        
        // Remove all children
        this.remove_all_children();
        
        // Create rows
        this._layoutDefinition.rows.forEach((rowKeys, rowIndex) => {
            let row = new St.Widget({
                layout_manager: new Clutter.BoxLayout({
                    orientation: Clutter.Orientation.HORIZONTAL,
                    spacing: this._layoutDefinition.spacing
                })
            });
            
            rowKeys.forEach((keyLabel, keyIndex) => {
                let key = new Key(keyLabel, this._layoutDefinition.keyWidth, this._layoutDefinition.keyHeight);
                key.connect('pressed', this._onKeyPressed.bind(this));
                row.add_child(key);
                this._keys.push(key);
            });
            
            this.add_child(row);
            this._rows.push(row);
        });
        
        // Apply theme
        this._applyTheme();
    }
    
    _animateKeyPress(key) {
        // Add animation class
        key.add_style_class_name('betterkeys-key-press-animation');
        
        // Record animation start time
        this._keyPressAnimations.set(key, {
            startTime: Date.now(),
            duration: 200 // ms
        });
        
        // Remove class after duration (fallback if animation loop not running)
        if (this._animationTimeoutId) {
            GLib.source_remove(this._animationTimeoutId);
        }
        this._animationTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
            key.remove_style_class_name('betterkeys-key-press-animation');
            this._keyPressAnimations.delete(key);
            this._animationTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }
    
    _onKeyPressed(key, keyLabel) {
        log(`[BetterKeys] Key pressed: ${keyLabel}`);
        
        // Emit signal for external handling
        this.emit('key-pressed', keyLabel);
        
        // Visual feedback
        this._animateKeyPress(key);
        
        // Handle special keys
        switch (keyLabel) {
            case 'Space':
                this._sendKey(' ');
                break;
            case 'Backspace':
                this._sendBackspace();
                break;
            case 'Enter':
                this._sendEnter();
                break;
            case 'Shift':
                this._toggleShift();
                break;
            case '?123':
                this._switchToSymbols();
                break;
            default:
                this._sendKey(keyLabel);
                break;
        }
        
        // Provide haptic feedback if enabled
        if (this._settings.getHapticFeedbackEnabled()) {
            this._provideHapticFeedback();
        }
        
        // Play sound if enabled
        if (this._settings.getKeyPressSoundEnabled()) {
            this._playKeySound();
        }
    }
    
    _sendKey(keyChar) {
        // TODO: Implement IBus integration
        log(`[BetterKeys] Would send key: ${keyChar}`);
    }
    
    _sendBackspace() {
        // TODO: Implement backspace via IBus
        log('[BetterKeys] Would send backspace');
    }
    
    _sendEnter() {
        // TODO: Implement enter via IBus
        log('[BetterKeys] Would send enter');
    }
    
    _toggleShift() {
        log('[BetterKeys] Would toggle shift');
        // TODO: Implement shift toggle
    }
    
    _switchToSymbols() {
        log('[BetterKeys] Would switch to symbols');
        // TODO: Implement symbol layout switching
    }
    
    _provideHapticFeedback() {
        // TODO: Implement haptic feedback
        log('[BetterKeys] Would provide haptic feedback');
    }
    
    _playKeySound() {
        // TODO: Implement key press sound
        log('[BetterKeys] Would play key sound');
    }
    
    _applyTheme() {
        let themeName = this._settings.getThemeName();
        
        // Remove existing theme classes
        this.remove_style_class_name('betterkeys-theme-default');
        this.remove_style_class_name('betterkeys-theme-dark');
        this.remove_style_class_name('betterkeys-theme-high-contrast');
        
        // Add new theme class
        this.add_style_class_name(`betterkeys-theme-${themeName}`);
        
        // Apply theme to all keys
        this._keys.forEach(key => {
            key.setTheme(themeName);
        });
    }
    
    /**
     * Get the key at the given screen coordinates (relative to keyboard).
     * @param {number} x - X coordinate relative to keyboard top‑left.
     * @param {number} y - Y coordinate relative to keyboard top‑left.
     * @returns {Key|null} The key actor, or null if none.
     */
    getKeyAtPosition(x, y) {
        for (const key of this._keys) {
            const [keyX, keyY] = key.get_transformed_position();
            const keyWidth = key.width;
            const keyHeight = key.height;
            
            if (x >= keyX && x <= keyX + keyWidth &&
                y >= keyY && y <= keyY + keyHeight) {
                return key;
            }
        }
        return null;
    }
    
    /**
     * Get the label of the key at the given coordinates.
     * @param {number} x - X coordinate.
     * @param {number} y - Y coordinate.
     * @returns {string|null} Key label.
     */
    getKeyLabelAtPosition(x, y) {
        const key = this.getKeyAtPosition(x, y);
        return key ? key.getLabel() : null;
    }
    
    /**
     * Update keyboard animations (called by animation loop).
     * @param {number} time - Current time in milliseconds.
     */
    updateAnimations(time) {
        // Update key press animations
        this._keyPressAnimations.forEach((animation, key) => {
            const elapsed = time - animation.startTime;
            if (elapsed >= animation.duration) {
                key.remove_style_class_name('betterkeys-key-press-animation');
                this._keyPressAnimations.delete(key);
            } else {
                // Update animation progress (could adjust scale, opacity, etc.)
                const progress = elapsed / animation.duration;
                // For now, we rely on CSS transitions
            }
        });
    }
    
    /**
     * Show the keyboard with animation.
     */
    show() {
        if (this._isVisible) {
            return;
        }
        
        // Delegate to window manager if available
        if (this._windowManager) {
            this._windowManager.show();
            this._isVisible = true;
            log('[BetterKeys] Keyboard shown via window manager');
            return;
        }
        
        // Add to the stage
        Main.uiGroup.add_child(this);
        
        // Update position based on docking
        this._updatePosition();
        
        // Set initial opacity for fade-in
        this.opacity = 0;
        
        // Animate opacity
        this.ease({
            opacity: 255,
            duration: 200,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._isVisible = true;
                log('[BetterKeys] Keyboard shown with animation');
            }
        });
    }
    
    /**
     * Hide the keyboard with animation.
     */
    hide() {
        if (!this._isVisible) {
            return;
        }
        
        // Delegate to window manager if available
        if (this._windowManager) {
            this._windowManager.hide();
            this._isVisible = false;
            log('[BetterKeys] Keyboard hidden via window manager');
            return;
        }
        
        this.ease({
            opacity: 0,
            duration: 150,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
            onComplete: () => {
                Main.uiGroup.remove_child(this);
                this._isVisible = false;
                log('[BetterKeys] Keyboard hidden with animation');
            }
        });
    }
    
    /**
     * Update keyboard position based on docking position and screen size.
     */
    _updatePosition() {
        if (!this.get_parent()) {
            return; // Not yet added to stage
        }
        
        let [width, height] = global.stage.get_size();
        let keyboardWidth = this.width;
        let keyboardHeight = this.height;
        let padding = 20;
        
        switch (this._dockingPosition) {
            case 'top':
                this.set_position(
                    Math.floor((width - keyboardWidth) / 2),
                    padding
                );
                break;
            case 'bottom':
                this.set_position(
                    Math.floor((width - keyboardWidth) / 2),
                    height - keyboardHeight - padding
                );
                break;
            case 'left':
                this.set_position(
                    padding,
                    Math.floor((height - keyboardHeight) / 2)
                );
                break;
            case 'right':
                this.set_position(
                    width - keyboardWidth - padding,
                    Math.floor((height - keyboardHeight) / 2)
                );
                break;
            case 'floating':
                // Keep current position, but ensure within screen bounds
                let x = this.x;
                let y = this.y;
                if (x < 0) x = 0;
                if (y < 0) y = 0;
                if (x + keyboardWidth > width) x = width - keyboardWidth;
                if (y + keyboardHeight > height) y = height - keyboardHeight;
                this.set_position(x, y);
                break;
        }
    }
    
    isVisible() {
        return this._isVisible;
    }
    
    onSettingsChanged(key) {
        log(`[BetterKeys] KeyboardUI received settings change: ${key}`);
        
        switch (key) {
            case 'theme-name':
                this._applyTheme();
                break;
            case 'current-layout':
                let newLayout = this._settings.getCurrentLayout();
                if (newLayout !== this._currentLayout) {
                    this.switchLayout(newLayout);
                }
                break;
            case 'show-layout-indicator':
                this._updateLayoutIndicator();
                break;
            case 'layout-preview-on-hover':
                // No immediate UI change, handled in hover events
                break;
            case 'keyboard-size':
                this.setKeyboardSize(this._settings.getKeyboardSize());
                break;
            case 'docking-position':
                this.setDockingPosition(this._settings.getDockingPosition());
                break;
        }
    }
    
    destroy() {
        this.hide();
        super.destroy();
        log('[BetterKeys] KeyboardUI destroyed');
    }
});

// Add signals to the class
BetterKeysKeyboardUI.signals = {
    'key-pressed': { param_types: [GObject.TYPE_STRING] },
    'layout-changed': { param_types: [GObject.TYPE_STRING] }
};

// Export the KeyboardUI class
var KeyboardUI = BetterKeysKeyboardUI;
