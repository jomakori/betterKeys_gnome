/* src/keyboard/layout-manager.js - Keyboard layout loading, validation, and management with advanced features */

const { GObject, Gio } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

/**
 * LayoutManager loads keyboard layouts from JSON files, validates them,
 * supports multiple layout types, caching, and composition.
 */
var LayoutManager = GObject.registerClass(
class LayoutManager extends GObject.Object {
    _init() {
        super._init();

        this._layouts = new Map(); // layoutId -> layout object
        this._layoutCache = new Map(); // layoutId -> cached layout (processed)
        this._layoutDirectory = Me.dir.get_child('data').get_child('layouts');
        this._defaultLayoutId = 'en_US_qwerty';

        // Supported layout types
        this._supportedTypes = ['alphabetic', 'numeric', 'symbol', 'emoji', 'custom', 'terminal', 'url', 'email', 'password', 'search'];

        // Layout composition rules
        this._compositionRules = new Map();
        this._setupCompositionRules();

        // Layout validation schema
        this._validationSchema = {
            required: ['id', 'name', 'rows'],
            optional: ['type', 'language', 'keyWidth', 'keyHeight', 'spacing', 'version', 'description', 'author', 'modifiers']
        };

        // Load all layouts on initialization
        this._loadAllLayouts();

        log('[betterKeys] LayoutManager initialized with advanced features');
    }

    /**
     * Load all layout files from the layouts directory.
     */
    _loadAllLayouts() {
        if (!this._layoutDirectory.query_exists(null)) {
            logError('[betterKeys] Layouts directory does not exist');
            return;
        }

        try {
            const enumerator = this._layoutDirectory.enumerate_children(
                'standard::*',
                Gio.FileQueryInfoFlags.NONE,
                null
            );

            let fileInfo;
            while ((fileInfo = enumerator.next_file(null)) !== null) {
                const fileName = fileInfo.get_name();
                if (fileName.endsWith('.json')) {
                    this._loadLayoutFile(fileName);
                }
            }

            enumerator.close(null);
            log(`[betterKeys] Loaded ${this._layouts.size} layout(s)`);
        } catch (error) {
            logError(`[betterKeys] Failed to enumerate layout files: ${error}`);
        }
    }

    /**
     * Load a single layout file.
     * @param {string} fileName - Name of the JSON file.
     */
    _loadLayoutFile(fileName) {
        const filePath = this._layoutDirectory.get_child(fileName);
        try {
            const [success, contents] = filePath.load_contents(null);
            if (!success) {
                throw new Error('Failed to read file');
            }

            const json = imports.byteArray.toString(contents);
            const layout = JSON.parse(json);

            // Validate layout
            if (this._validateLayout(layout)) {
                const layoutId = layout.id;
                this._layouts.set(layoutId, layout);
                log(`[betterKeys] Loaded layout: ${layoutId}`);
            } else {
                logError(`[betterKeys] Invalid layout in file ${fileName}`);
            }
        } catch (error) {
            logError(`[betterKeys] Failed to load layout file ${fileName}: ${error}`);
        }
    }

    /**
     * Validate a layout object against schema.
     * @param {Object} layout - Layout object.
     * @returns {boolean} True if valid.
     */
    _validateLayout(layout) {
        // Required fields
        if (!layout.id || typeof layout.id !== 'string') {
            logError('[betterKeys] Layout missing or invalid id');
            return false;
        }
        if (!layout.name || typeof layout.name !== 'string') {
            logError('[betterKeys] Layout missing or invalid name');
            return false;
        }
        if (!layout.rows || !Array.isArray(layout.rows)) {
            logError('[betterKeys] Layout missing or invalid rows');
            return false;
        }

        // Validate each row
        for (let i = 0; i < layout.rows.length; i++) {
            const row = layout.rows[i];
            if (!row.keys || !Array.isArray(row.keys)) {
                logError(`[betterKeys] Row ${i} missing keys array`);
                return false;
            }
            // Each key must be a string
            for (const key of row.keys) {
                if (typeof key !== 'string') {
                    logError(`[betterKeys] Row ${i} contains non‑string key`);
                    return false;
                }
            }
        }

        // Optional fields with defaults
        if (layout.keyWidth && typeof layout.keyWidth !== 'number') {
            logError('[betterKeys] keyWidth must be a number');
            return false;
        }
        if (layout.keyHeight && typeof layout.keyHeight !== 'number') {
            logError('[betterKeys] keyHeight must be a number');
            return false;
        }
        if (layout.spacing && typeof layout.spacing !== 'number') {
            logError('[betterKeys] spacing must be a number');
            return false;
        }
        if (layout.type && !this._supportedTypes.includes(layout.type)) {
            logError(`[betterKeys] Unsupported layout type: ${layout.type}`);
            return false;
        }

        return true;
    }

    /**
     * Load a specific layout by ID.
     * @param {string} layoutId - Layout identifier.
     * @returns {Object|null} Layout object or null if not found.
     */
    loadLayout(layoutId) {
        // Check cache first
        if (this._layoutCache.has(layoutId)) {
            log(`[betterKeys] Returning cached layout: ${layoutId}`);
            return this._layoutCache.get(layoutId);
        }

        // Check if already loaded
        let layout = this._layouts.get(layoutId);
        if (!layout) {
            // Try to load from file dynamically
            const fileName = `${layoutId}.json`;
            this._loadLayoutFile(fileName);
            layout = this._layouts.get(layoutId);
        }

        if (!layout) {
            logError(`[betterKeys] Layout not found: ${layoutId}`);
            return null;
        }

        // Process layout (apply defaults, compute derived properties)
        const processedLayout = this._processLayout(layout);

        // Cache it
        this._layoutCache.set(layoutId, processedLayout);

        return processedLayout;
    }

    /**
     * Process a raw layout object, applying defaults and computing derived properties.
     * @param {Object} layout - Raw layout object.
     * @returns {Object} Processed layout.
     */
    _processLayout(layout) {
        // Create a deep copy
        const processed = JSON.parse(JSON.stringify(layout));

        // Apply defaults
        processed.keyWidth = processed.keyWidth || 60;
        processed.keyHeight = processed.keyHeight || 60;
        processed.spacing = processed.spacing || 4;
        processed.type = processed.type || 'alphabetic';
        processed.language = processed.language || 'en_US';
        processed.defaultShiftState = processed.defaultShiftState || 'lowercase';

        // Compute total width and height
        let totalWidth = 0;
        let totalHeight = 0;

        processed.rows.forEach(row => {
            const rowWidth = row.keys.length * processed.keyWidth +
                           (row.keys.length - 1) * processed.spacing;
            totalWidth = Math.max(totalWidth, rowWidth);
            totalHeight += (row.height || processed.keyHeight) + processed.spacing;
        });

        // Remove trailing spacing
        if (processed.rows.length > 0) {
            totalHeight -= processed.spacing;
        }

        processed.totalWidth = totalWidth;
        processed.totalHeight = totalHeight;

        // Generate key positions for quick lookup
        processed.keyPositions = this._computeKeyPositions(processed);

        return processed;
    }

    /**
     * Compute positions of each key within the layout.
     * @param {Object} layout - Processed layout.
     * @returns {Map} Map from key label to { row, column, x, y, width, height }.
     */
    _computeKeyPositions(layout) {
        const positions = new Map();
        let y = 0;

        for (let rowIdx = 0; rowIdx < layout.rows.length; rowIdx++) {
            const row = layout.rows[rowIdx];
            const rowHeight = row.height || layout.keyHeight;
            let x = 0;

            // Center the row if it has fewer keys
            const rowWidth = row.keys.length * layout.keyWidth +
                           (row.keys.length - 1) * layout.spacing;
            const rowXOffset = (layout.totalWidth - rowWidth) / 2;

            x += rowXOffset;

            for (let colIdx = 0; colIdx < row.keys.length; colIdx++) {
                const keyLabel = row.keys[colIdx];
                const keyWidth = this._getKeyWidth(keyLabel, layout);
                const keyHeight = rowHeight;

                positions.set(keyLabel, {
                    row: rowIdx,
                    column: colIdx,
                    x: x,
                    y: y,
                    width: keyWidth,
                    height: keyHeight,
                    label: keyLabel
                });

                x += keyWidth + layout.spacing;
            }

            y += rowHeight + layout.spacing;
        }

        return positions;
    }

    /**
     * Determine width of a key based on its label.
     * @param {string} keyLabel - Key label.
     * @param {Object} layout - Layout object.
     * @returns {number} Key width.
     */
    _getKeyWidth(keyLabel, layout) {
        // Special keys may have different widths
        switch (keyLabel) {
            case 'Space':
                return layout.keyWidth * 3;
            case 'Enter':
            case 'Backspace':
            case 'Shift':
                return layout.keyWidth * 1.5;
            case '?123':
                return layout.keyWidth * 1.2;
            default:
                return layout.keyWidth;
        }
    }

    /**
     * Get all available layout IDs.
     * @returns {string[]} Array of layout IDs.
     */
    getAvailableLayouts() {
        return Array.from(this._layouts.keys());
    }

    /**
     * Get layout metadata (id, name, type, language) for all layouts.
     * @returns {Object[]} Array of layout metadata.
     */
    getLayoutsMetadata() {
        const metadata = [];
        for (const [id, layout] of this._layouts) {
            metadata.push({
                id,
                name: layout.name,
                type: layout.type || 'alphabetic',
                language: layout.language || 'en_US',
                rows: layout.rows.length,
                keyCount: layout.rows.reduce((sum, row) => sum + row.keys.length, 0)
            });
        }
        return metadata;
    }

    /**
     * Switch to a different layout (alias for loadLayout).
     * @param {string} layoutId - Layout identifier.
     * @returns {Object|null} Processed layout.
     */
    switchLayout(layoutId) {
        const layout = this.loadLayout(layoutId);
        if (layout) {
            this.emit('layout-switched', layoutId);
            log(`[betterKeys] Switched to layout: ${layoutId}`);
        }
        return layout;
    }

    /**
     * Compose two layouts (base + modifier).
     * For example, base QWERTY with Shift applied.
     * @param {string} baseLayoutId - Base layout ID.
     * @param {string} modifier - Modifier ('shift', 'alt', 'symbol').
     * @returns {Object|null} Composed layout.
     */
    composeLayout(baseLayoutId, modifier) {
        const base = this.loadLayout(baseLayoutId);
        if (!base) {
            return null;
        }

        // For now, we only handle shift composition
        if (modifier === 'shift') {
            return this._applyShift(base);
        }

        // Other modifiers could be implemented here
        log(`[betterKeys] Modifier ${modifier} not yet supported`);
        return base;
    }

    /**
     * Apply shift transformation to a layout (uppercase letters).
     * @param {Object} layout - Base layout.
     * @returns {Object} Shifted layout.
     */
    _applyShift(layout) {
        const shifted = JSON.parse(JSON.stringify(layout));

        for (const row of shifted.rows) {
            for (let i = 0; i < row.keys.length; i++) {
                const key = row.keys[i];
                // Only shift single letter keys
                if (key.length === 1 && /[a-z]/i.test(key)) {
                    row.keys[i] = key.toUpperCase();
                }
            }
        }

        shifted.id = `${layout.id}_shifted`;
        shifted.name = `${layout.name} (Shifted)`;
        shifted.defaultShiftState = 'uppercase';

        // Recompute positions
        shifted.keyPositions = this._computeKeyPositions(shifted);

        return shifted;
    }

    /**
     * Clear the layout cache.
     */
    clearCache() {
        this._layoutCache.clear();
        log('[betterKeys] Layout cache cleared');
    }

    /**
     * Reload all layouts from disk.
     */
    reloadLayouts() {
        this._layouts.clear();
        this._layoutCache.clear();
        this._loadAllLayouts();
        this.emit('layouts-reloaded');
        log('[betterKeys] Layouts reloaded');
    }

    /**
     * Get a key's position within a layout.
     * @param {string} layoutId - Layout identifier.
     * @param {string} keyLabel - Key label.
     * @returns {Object|null} Key position object.
     */
    getKeyPosition(layoutId, keyLabel) {
        const layout = this.loadLayout(layoutId);
        if (!layout || !layout.keyPositions) {
            return null;
        }
        return layout.keyPositions.get(keyLabel) || null;
    }

    /**
     * Find which key is at a given coordinate within a layout.
     * @param {string} layoutId - Layout identifier.
     * @param {number} x - X coordinate relative to layout top‑left.
     * @param {number} y - Y coordinate relative to layout top‑left.
     * @returns {string|null} Key label or null.
     */
    getKeyAtCoordinate(layoutId, x, y) {
        const layout = this.loadLayout(layoutId);
        if (!layout || !layout.keyPositions) {
            return null;
        }

        for (const [label, pos] of layout.keyPositions) {
            if (x >= pos.x && x <= pos.x + pos.width &&
                y >= pos.y && y <= pos.y + pos.height) {
                return label;
            }
        }

        return null;
    }

    /**
     * Set up composition rules for layout modifiers.
     */
    _setupCompositionRules() {
        this._compositionRules.set('shift', {
            transform: (layout) => this._applyShift(layout),
            description: 'Uppercase transformation'
        });

        this._compositionRules.set('alt', {
            transform: (layout) => this._applyAlt(layout),
            description: 'Alternative characters'
        });

        this._compositionRules.set('symbol', {
            transform: (layout) => this._applySymbol(layout),
            description: 'Symbol layer'
        });

        this._compositionRules.set('numeric', {
            transform: (layout) => this._applyNumeric(layout),
            description: 'Numeric keypad'
        });
    }

    /**
     * Apply alternative character transformation.
     * @param {Object} layout - Base layout.
     * @returns {Object} Transformed layout.
     */
    _applyAlt(layout) {
        const altLayout = JSON.parse(JSON.stringify(layout));

        // Map common alternative characters
        const altMap = {
            'a': 'á', 'e': 'é', 'i': 'í', 'o': 'ó', 'u': 'ú',
            'A': 'Á', 'E': 'É', 'I': 'Í', 'O': 'Ó', 'U': 'Ú',
            'n': 'ñ', 'N': 'Ñ', 'c': 'ç', 'C': 'Ç'
        };

        for (const row of altLayout.rows) {
            for (let i = 0; i < row.keys.length; i++) {
                const key = row.keys[i];
                if (altMap[key]) {
                    row.keys[i] = altMap[key];
                }
            }
        }

        altLayout.id = `${layout.id}_alt`;
        altLayout.name = `${layout.name} (Alt)`;
        altLayout.keyPositions = this._computeKeyPositions(altLayout);

        return altLayout;
    }

    /**
     * Apply symbol transformation.
     * @param {Object} layout - Base layout.
     * @returns {Object} Symbol layout.
     */
    _applySymbol(layout) {
        const symbolLayout = JSON.parse(JSON.stringify(layout));

        // Replace with common symbols
        const symbolMap = {
            '1': '!', '2': '@', '3': '#', '4': '$', '5': '%',
            '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
            '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|',
            ';': ':', '\'': '"', ',': '<', '.': '>', '/': '?'
        };

        for (const row of symbolLayout.rows) {
            for (let i = 0; i < row.keys.length; i++) {
                const key = row.keys[i];
                if (symbolMap[key]) {
                    row.keys[i] = symbolMap[key];
                }
            }
        }

        symbolLayout.id = `${layout.id}_symbol`;
        symbolLayout.name = `${layout.name} (Symbol)`;
        symbolLayout.keyPositions = this._computeKeyPositions(symbolLayout);

        return symbolLayout;
    }

    /**
     * Apply numeric transformation.
     * @param {Object} layout - Base layout.
     * @returns {Object} Numeric layout.
     */
    _applyNumeric(layout) {
        const numericLayout = {
            id: `${layout.id}_numeric`,
            name: `${layout.name} (Numeric)`,
            type: 'numeric',
            language: layout.language,
            keyWidth: layout.keyWidth,
            keyHeight: layout.keyHeight,
            spacing: layout.spacing,
            rows: [
                { keys: ['7', '8', '9'] },
                { keys: ['4', '5', '6'] },
                { keys: ['1', '2', '3'] },
                { keys: ['0', '.', 'Backspace'] }
            ]
        };

        return this._processLayout(numericLayout);
    }

    /**
     * Compose multiple modifiers.
     * @param {string} baseLayoutId - Base layout ID.
     * @param {Array} modifiers - Array of modifier names.
     * @returns {Object|null} Composed layout.
     */
    composeMultiple(baseLayoutId, modifiers) {
        let layout = this.loadLayout(baseLayoutId);
        if (!layout) {
            return null;
        }

        for (const modifier of modifiers) {
            const rule = this._compositionRules.get(modifier);
            if (rule) {
                layout = rule.transform(layout);
            }
        }

        return layout;
    }

    /**
     * Create a custom layout from JSON.
     * @param {Object} layoutData - Layout data.
     * @returns {Object} Created layout.
     */
    createCustomLayout(layoutData) {
        if (!this._validateLayout(layoutData)) {
            throw new Error('Invalid layout data');
        }

        // Ensure unique ID
        if (this._layouts.has(layoutData.id)) {
            layoutData.id = `${layoutData.id}_custom_${Date.now()}`;
        }

        // Add metadata
        layoutData.custom = true;
        layoutData.created = Date.now();
        layoutData.version = layoutData.version || '1.0';

        // Store layout
        this._layouts.set(layoutData.id, layoutData);
        this._layoutCache.delete(layoutData.id); // Clear cache

        this.emit('layout-created', layoutData.id);
        log(`[betterKeys] Custom layout created: ${layoutData.id}`);

        return this.loadLayout(layoutData.id);
    }

    /**
     * Export layout to JSON string.
     * @param {string} layoutId - Layout ID.
     * @returns {string} JSON string.
     */
    exportLayout(layoutId) {
        const layout = this._layouts.get(layoutId);
        if (!layout) {
            throw new Error(`Layout not found: ${layoutId}`);
        }

        return JSON.stringify(layout, null, 2);
    }

    /**
     * Import layout from JSON string.
     * @param {string} json - JSON string.
     * @returns {Object} Imported layout.
     */
    importLayout(json) {
        try {
            const layoutData = JSON.parse(json);
            return this.createCustomLayout(layoutData);
        } catch (error) {
            logError(`[betterKeys] Failed to import layout: ${error}`);
            throw error;
        }
    }

    /**
     * Get layout validation errors.
     * @param {Object} layout - Layout to validate.
     * @returns {Array} Array of error messages.
     */
    validateLayoutWithErrors(layout) {
        const errors = [];

        // Check required fields
        this._validationSchema.required.forEach(field => {
            if (!layout[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        });

        // Check rows structure
        if (!Array.isArray(layout.rows)) {
            errors.push('Rows must be an array');
        } else {
            layout.rows.forEach((row, rowIndex) => {
                if (!row.keys || !Array.isArray(row.keys)) {
                    errors.push(`Row ${rowIndex}: missing keys array`);
                } else {
                    row.keys.forEach((key, keyIndex) => {
                        if (typeof key !== 'string') {
                            errors.push(`Row ${rowIndex}, key ${keyIndex}: must be string`);
                        }
                    });
                }
            });
        }

        // Check type
        if (layout.type && !this._supportedTypes.includes(layout.type)) {
            errors.push(`Unsupported type: ${layout.type}. Supported: ${this._supportedTypes.join(', ')}`);
        }

        return errors;
    }

    /**
     * Get layout statistics.
     * @param {string} layoutId - Layout ID.
     * @returns {Object} Statistics.
     */
    getLayoutStats(layoutId) {
        const layout = this.loadLayout(layoutId);
        if (!layout) {
            return null;
        }

        const keyCount = layout.rows.reduce((sum, row) => sum + row.keys.length, 0);
        const uniqueKeys = new Set();
        layout.rows.forEach(row => row.keys.forEach(key => uniqueKeys.add(key)));

        return {
            id: layout.id,
            name: layout.name,
            type: layout.type,
            language: layout.language,
            rows: layout.rows.length,
            totalKeys: keyCount,
            uniqueKeys: uniqueKeys.size,
            width: layout.totalWidth,
            height: layout.totalHeight,
            keyWidth: layout.keyWidth,
            keyHeight: layout.keyHeight,
            spacing: layout.spacing,
            custom: layout.custom || false
        };
    }

    /**
     * Get all layout statistics.
     * @returns {Array} Array of layout stats.
     */
    getAllLayoutStats() {
        const stats = [];
        for (const layoutId of this.getAvailableLayouts()) {
            const stat = this.getLayoutStats(layoutId);
            if (stat) {
                stats.push(stat);
            }
        }
        return stats;
    }

    /**
     * Migrate layout to newer version.
     * @param {Object} layout - Layout to migrate.
     * @param {string} targetVersion - Target version.
     * @returns {Object} Migrated layout.
     */
    migrateLayout(layout, _targetVersion = '1.0') {
        const migrated = JSON.parse(JSON.stringify(layout));

        // Version 1.0 migration
        if (!migrated.version) {
            migrated.version = '1.0';
            migrated.modifiers = migrated.modifiers || [];
            migrated.description = migrated.description || '';
        }

        return migrated;
    }

    /**
     * Get default layout.
     * @returns {string} Default layout ID.
     */
    getDefaultLayout() {
        return this._defaultLayoutId;
    }

    /**
     * Set default layout.
     * @param {string} layoutId - New default layout ID.
     */
    setDefaultLayout(layoutId) {
        if (this._layouts.has(layoutId)) {
            this._defaultLayoutId = layoutId;
            log(`[betterKeys] Default layout set to: ${layoutId}`);
        } else {
            logError(`[betterKeys] Cannot set default layout: ${layoutId} not found`);
        }
    }

    /**
     * Get composition rules.
     * @returns {Map} Composition rules.
     */
    getCompositionRules() {
        return new Map(this._compositionRules);
    }

    /**
     * Get validation schema.
     * @returns {Object} Validation schema.
     */
    getValidationSchema() {
        return { ...this._validationSchema };
    }
});

// Add signals to the class
LayoutManager.signals = {
    'layout-switched': { param_types: [GObject.TYPE_STRING] },
    'layouts-reloaded': { param_types: [] },
    'layout-created': { param_types: [GObject.TYPE_STRING] },
    'layout-imported': { param_types: [GObject.TYPE_STRING] }
};
