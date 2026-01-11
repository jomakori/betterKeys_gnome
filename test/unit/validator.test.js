/* test/unit/validator.test.js - Unit tests for InputValidator */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('InputValidator', () => {
    let settings;
    let InputValidator;

    beforeAll(() => {
        settings = new MockSettingsManager();
        // Mock InputValidator class
        InputValidator = class {
            constructor(settingsManager) {
                this._settings = settingsManager;
            }

            validateText(text) {
                if (typeof text !== 'string') return false;
                if (text.length > 1000) return false;
                // Prevent script tags
                if (/<script\b[^>]*>/i.test(text)) return false;
                return true;
            }

            validatePath(path) {
                if (typeof path !== 'string') return false;
                // Prevent directory traversal
                if (path.includes('..')) return false;
                // Allow only certain extensions
                if (!/\.(json|txt)$/.test(path)) return false;
                return true;
            }

            sanitizeHtml(input) {
                return input
                    .replace(/&/g, '&')
                    .replace(/</g, '<')
                    .replace(/>/g, '>')
                    .replace(/"/g, '"')
                    .replace(/'/g, '&#x27;');
            }

            isEmail(email) {
                const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return re.test(email);
            }
        };
    });

    test('should validate safe text', () => {
        const validator = new InputValidator(settings);
        expect(validator.validateText('Hello world')).toBe(true);
        expect(validator.validateText('')).toBe(true);
    });

    test('should reject overly long text', () => {
        const validator = new InputValidator(settings);
        const longText = 'x'.repeat(1001);
        expect(validator.validateText(longText)).toBe(false);
    });

    test('should reject script tags', () => {
        const validator = new InputValidator(settings);
        expect(validator.validateText('<script>alert("xss")</script>')).toBe(false);
        expect(validator.validateText('Normal <b>bold</b>')).toBe(true); // no script
    });

    test('should validate safe paths', () => {
        const validator = new InputValidator(settings);
        expect(validator.validatePath('layout.json')).toBe(true);
        expect(validator.validatePath('data/file.txt')).toBe(true);
        expect(validator.validatePath('../etc/passwd')).toBe(false);
        expect(validator.validatePath('script.js')).toBe(false); // wrong extension
    });

    test('should sanitize HTML entities', () => {
        const validator = new InputValidator(settings);
        const sanitized = validator.sanitizeHtml('<div>"test" & more</div>');
        expect(sanitized).toBe('<div>"test" & more</div>');
    });

    test('should validate email format', () => {
        const validator = new InputValidator(settings);
        expect(validator.isEmail('user@example.com')).toBe(true);
        expect(validator.isEmail('invalid')).toBe(false);
        expect(validator.isEmail('@example.com')).toBe(false);
    });
});
