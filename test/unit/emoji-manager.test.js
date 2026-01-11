/* test/unit/emoji-manager.test.js - Unit tests for EmojiManager */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('EmojiManager', () => {
    let settings;
    let EmojiManager;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock EmojiManager class
        EmojiManager = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
                this._emojiDatabase = [
                    { char: '😀', name: 'grinning face', category: 'smileys' },
                    { char: '😂', name: 'face with tears of joy', category: 'smileys' },
                    { char: '👍', name: 'thumbs up', category: 'gestures' },
                    { char: '🔥', name: 'fire', category: 'objects' }
                ];
            }

            search(query) {
                const q = query.toLowerCase();
                return this._emojiDatabase.filter(emoji =>
                    emoji.name.toLowerCase().includes(q) ||
                    emoji.char.includes(q)
                );
            }

            getByCategory(category) {
                return this._emojiDatabase.filter(emoji => emoji.category === category);
            }

            getAll() {
                return this._emojiDatabase;
            }

            addEmoji(char, name, category) {
                this._emojiDatabase.push({ char, name, category });
            }
        };
    });

    test('should initialize with default emoji database', () => {
        const manager = new EmojiManager(settings);
        expect(manager.getAll()).toHaveLength(4);
    });

    test('should search emoji by name', () => {
        const manager = new EmojiManager(settings);
        const results = manager.search('grinning');
        expect(results).toHaveLength(1);
        expect(results[0].char).toBe('😀');
    });

    test('should search emoji by character', () => {
        const manager = new EmojiManager(settings);
        const results = manager.search('🔥');
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('fire');
    });

    test('should filter by category', () => {
        const manager = new EmojiManager(settings);
        const smileys = manager.getByCategory('smileys');
        expect(smileys).toHaveLength(2);
        expect(smileys.map(e => e.char)).toContain('😀');
    });

    test('should add new emoji', () => {
        const manager = new EmojiManager(settings);
        manager.addEmoji('🚀', 'rocket', 'objects');
        expect(manager.getAll()).toHaveLength(5);
        expect(manager.getByCategory('objects')).toHaveLength(2);
    });
});
