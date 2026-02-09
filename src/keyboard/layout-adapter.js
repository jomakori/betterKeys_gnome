/* src/keyboard/layout-adapter.js - Dynamic layout adaptation based on context */

const { GObject, GLib, Meta } = imports.gi;

/**
 * LayoutAdapter - Adapts keyboard layout based on active window and input context
 */
var LayoutAdapter = GObject.registerClass(
class LayoutAdapter extends GObject.Object {
    _init(layoutManager, settingsManager) {
        super._init();

        this._layoutManager = layoutManager;
        this._settings = settingsManager;

        // Configuration
        this._config = {
            enableAutoSwitch: true,
            enableAppDetection: true,
            enableInputTypeDetection: true,
            switchDelay: 300, // ms delay before switching
            cacheLayouts: true,
            maxCacheSize: 50,
            enableSmoothTransitions: true
        };

        // State tracking
        this._currentApp = null;
        this._currentInputType = 'text';
        this._currentLayout = null;
        this._previousLayout = null;
        this._layoutCache = new Map(); // app -> layout
        this._appRules = new Map(); // app -> layout rules

        // Window tracking
        this._windowTracker = null;
        this._focusWindow = null;
        this._lastSwitchTime = 0;

        // Load app rules
        this._loadAppRules();

        log('[betterKeys] LayoutAdapter initialized');
    }

    /**
     * Start monitoring window and input changes.
     */
    start() {
        if (this._windowTracker) {
            return; // Already started
        }

        try {
            // Get window tracker
            this._windowTracker = Meta.WindowTracker.get_default();

            // Connect to focus change signals
            const display = global.display;
            if (display) {
                this._focusChangedId = display.connect('notify::focus-window', () => {
                    this._onFocusChanged();
                });
            }

            // Monitor active window
            this._updateActiveWindow();

            log('[betterKeys] LayoutAdapter started');
        } catch (error) {
            logError(`[betterKeys] Failed to start LayoutAdapter: ${error}`);
        }
    }

    /**
     * Stop monitoring.
     */
    stop() {
        if (this._windowTracker && this._focusChangedId) {
            const display = global.display;
            if (display) {
                display.disconnect(this._focusChangedId);
            }
            this._focusChangedId = 0;
        }

        this._windowTracker = null;
        this._focusWindow = null;

        log('[betterKeys] LayoutAdapter stopped');
    }

    /**
     * Handle focus window change.
     */
    _onFocusChanged() {
        if (!this._config.enableAutoSwitch) {
            return;
        }

        this._updateActiveWindow();

        // Debounce switching
        const now = GLib.get_monotonic_time() / 1000;
        if (now - this._lastSwitchTime < this._config.switchDelay) {
            return;
        }

        this._adaptLayoutToContext();
    }

    /**
     * Update active window information.
     */
    _updateActiveWindow() {
        try {
            const display = global.display;
            if (!display) {
                return;
            }

            this._focusWindow = display.get_focus_window();
            if (!this._focusWindow) {
                this._currentApp = null;
                return;
            }

            // Get window properties
            const wmClass = this._focusWindow.get_wm_class();
            const title = this._focusWindow.get_title();
            const appId = this._focusWindow.get_application_id();

            this._currentApp = {
                id: appId || wmClass || 'unknown',
                wmClass: wmClass,
                title: title,
                windowType: this._focusWindow.get_window_type()
            };

            // Detect input type based on window properties
            this._detectInputType();

            log(`[betterKeys] Active window: ${this._currentApp.id} (${title})`);
        } catch (error) {
            logError(`[betterKeys] Failed to update active window: ${error}`);
        }
    }

    /**
     * Detect input type based on window context.
     */
    _detectInputType() {
        if (!this._config.enableInputTypeDetection || !this._currentApp) {
            this._currentInputType = 'text';
            return;
        }

        const appId = this._currentApp.id.toLowerCase();
        const title = this._currentApp.title.toLowerCase();

        // Detect based on application
        if (appId.includes('terminal') || appId.includes('gnome-terminal')) {
            this._currentInputType = 'terminal';
        } else if (appId.includes('calculator') || title.includes('calculator')) {
            this._currentInputType = 'numeric';
        } else if (appId.includes('browser') || appId.includes('firefox') || appId.includes('chrome')) {
            // Browser - could be URL, search, or general text
            if (title.includes('url') || title.includes('address')) {
                this._currentInputType = 'url';
            } else if (title.includes('search')) {
                this._currentInputType = 'search';
            } else {
                this._currentInputType = 'text';
            }
        } else if (appId.includes('email') || appId.includes('thunderbird')) {
            this._currentInputType = 'email';
        } else if (appId.includes('password') || title.includes('password')) {
            this._currentInputType = 'password';
        } else {
            this._currentInputType = 'text';
        }

        log(`[betterKeys] Detected input type: ${this._currentInputType}`);
    }

    /**
     * Adapt layout based on current context.
     */
    _adaptLayoutToContext() {
        if (!this._config.enableAutoSwitch) {
            return;
        }

        const layout = this._getOptimalLayout();
        if (layout && layout !== this._currentLayout) {
            this._switchToLayout(layout);
        }
    }

    /**
     * Get optimal layout for current context.
     * @returns {string} Layout identifier.
     */
    _getOptimalLayout() {
        // Check cache first
        if (this._config.cacheLayouts && this._currentApp) {
            const cacheKey = `${this._currentApp.id}_${this._currentInputType}`;
            if (this._layoutCache.has(cacheKey)) {
                return this._layoutCache.get(cacheKey);
            }
        }

        let layout = null;

        // Check app-specific rules
        if (this._currentApp && this._appRules.has(this._currentApp.id)) {
            const rules = this._appRules.get(this._currentApp.id);
            layout = rules.layout;
        }

        // Check input type preferences
        if (!layout) {
            layout = this._getLayoutForInputType(this._currentInputType);
        }

        // Fallback to default layout
        if (!layout) {
            layout = this._layoutManager.getDefaultLayout();
        }

        // Update cache
        if (this._config.cacheLayouts && this._currentApp && layout) {
            const cacheKey = `${this._currentApp.id}_${this._currentInputType}`;
            this._layoutCache.set(cacheKey, layout);

            // Limit cache size
            if (this._layoutCache.size > this._config.maxCacheSize) {
                const firstKey = this._layoutCache.keys().next().value;
                this._layoutCache.delete(firstKey);
            }
        }

        return layout;
    }

    /**
     * Get layout for specific input type.
     * @param {string} inputType - Input type.
     * @returns {string} Layout identifier.
     */
    _getLayoutForInputType(inputType) {
        const typeToLayout = {
            'numeric': 'numeric',
            'terminal': 'terminal',
            'url': 'url',
            'email': 'email',
            'password': 'password',
            'search': 'search',
            'text': 'qwerty'
        };

        return typeToLayout[inputType] || null;
    }

    /**
     * Switch to a specific layout.
     * @param {string} layoutId - Layout identifier.
     */
    _switchToLayout(layoutId) {
        try {
            this._previousLayout = this._currentLayout;
            this._currentLayout = layoutId;

            // Notify layout manager
            this._layoutManager.switchToLayout(layoutId);

            this._lastSwitchTime = GLib.get_monotonic_time() / 1000;

            log(`[betterKeys] Layout switched to: ${layoutId}`);
            this.emit('layout-switched', layoutId, this._previousLayout);
        } catch (error) {
            logError(`[betterKeys] Failed to switch layout: ${error}`);
        }
    }

    /**
     * Load application-specific layout rules.
     */
    _loadAppRules() {
        // Default app rules
        const defaultRules = {
            'gnome-terminal': { layout: 'terminal', priority: 1 },
            'org.gnome.Calculator': { layout: 'numeric', priority: 1 },
            'firefox': { layout: 'browser', priority: 2 },
            'google-chrome': { layout: 'browser', priority: 2 },
            'thunderbird': { layout: 'email', priority: 2 },
            'org.gnome.gedit': { layout: 'text', priority: 3 }
        };

        Object.entries(defaultRules).forEach(([appId, rule]) => {
            this._appRules.set(appId, rule);
        });

        // Load custom rules from settings
        this._loadCustomRules();
    }

    /**
     * Load custom rules from settings.
     */
    _loadCustomRules() {
        try {
            const customRules = this._settings.get_custom_layout_rules();
            if (customRules && Array.isArray(customRules)) {
                customRules.forEach(rule => {
                    if (rule.appId && rule.layout) {
                        this._appRules.set(rule.appId, {
                            layout: rule.layout,
                            priority: rule.priority || 5,
                            inputType: rule.inputType
                        });
                    }
                });
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load custom rules: ${error}`);
        }
    }

    /**
     * Add custom layout rule.
     * @param {string} appId - Application identifier.
     * @param {Object} rule - Layout rule.
     * @returns {boolean} True if added.
     */
    addAppRule(appId, rule) {
        if (!appId || !rule || !rule.layout) {
            return false;
        }

        this._appRules.set(appId, {
            layout: rule.layout,
            priority: rule.priority || 5,
            inputType: rule.inputType,
            custom: true
        });

        // Clear cache for this app
        this._clearCacheForApp(appId);

        log(`[betterKeys] Added layout rule for ${appId}: ${rule.layout}`);
        return true;
    }

    /**
     * Remove app rule.
     * @param {string} appId - Application identifier.
     * @returns {boolean} True if removed.
     */
    removeAppRule(appId) {
        const removed = this._appRules.delete(appId);
        if (removed) {
            this._clearCacheForApp(appId);
            log(`[betterKeys] Removed layout rule for ${appId}`);
        }
        return removed;
    }

    /**
     * Clear cache entries for an app.
     * @param {string} appId - Application identifier.
     */
    _clearCacheForApp(appId) {
        const keysToDelete = [];
        for (const key of this._layoutCache.keys()) {
            if (key.startsWith(appId)) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this._layoutCache.delete(key));
    }

    /**
     * Get current context information.
     * @returns {Object} Context object.
     */
    getCurrentContext() {
        return {
            app: this._currentApp ? { ...this._currentApp } : null,
            inputType: this._currentInputType,
            currentLayout: this._currentLayout,
            previousLayout: this._previousLayout,
            lastSwitchTime: this._lastSwitchTime
        };
    }

    /**
     * Get all app rules.
     * @returns {Array} Array of app rules.
     */
    getAppRules() {
        const rules = [];
        for (const [appId, rule] of this._appRules) {
            rules.push({
                appId,
                layout: rule.layout,
                priority: rule.priority,
                inputType: rule.inputType,
                custom: rule.custom || false
            });
        }
        return rules;
    }

    /**
     * Manually trigger layout adaptation.
     */
    adaptNow() {
        this._updateActiveWindow();
        this._adaptLayoutToContext();
    }

    /**
     * Switch to previous layout.
     * @returns {boolean} True if switched.
     */
    switchToPreviousLayout() {
        if (!this._previousLayout) {
            return false;
        }

        this._switchToLayout(this._previousLayout);
        return true;
    }

    /**
     * Get layout adapter statistics.
     * @returns {Object} Statistics object.
     */
    getStats() {
        return {
            appRules: this._appRules.size,
            layoutCache: this._layoutCache.size,
            currentApp: this._currentApp ? this._currentApp.id : 'none',
            currentInputType: this._currentInputType,
            currentLayout: this._currentLayout,
            config: { ...this._config }
        };
    }

    /**
     * Update configuration.
     * @param {Object} config - New configuration values.
     */
    updateConfig(config) {
        Object.assign(this._config, config);
        log('[betterKeys] LayoutAdapter configuration updated');
    }

    /**
     * Get current configuration.
     * @returns {Object} Configuration object.
     */
    getConfig() {
        return { ...this._config };
    }

    /**
     * Clear layout cache.
     */
    clearCache() {
        this._layoutCache.clear();
        log('[betterKeys] Layout cache cleared');
    }
});

// Add signals
LayoutAdapter.signals = {
    'layout-switched': { param_types: [GObject.TYPE_STRING, GObject.TYPE_STRING] },
    'context-changed': { param_types: [GObject.TYPE_POINTER] }
};
