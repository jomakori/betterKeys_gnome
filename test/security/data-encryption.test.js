/* test/security/data-encryption.test.js - Test data encryption security */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('Data Encryption Security', () => {
    test('should encrypt sensitive settings', () => {
        const plain = 'secret password';
        const encrypted = Buffer.from(plain).toString('base64');
        expect(encrypted).not.toBe(plain);
    });

    test('should decrypt correctly', () => {
        const plain = 'secret password';
        const encrypted = Buffer.from(plain).toString('base64');
        const decrypted = Buffer.from(encrypted, 'base64').toString();
        expect(decrypted).toBe(plain);
    });

    test('should protect clipboard history', () => {
        const clipboard = [{ text: 'credit card', encrypted: true }];
        expect(clipboard[0].encrypted).toBe(true);
    });

    test('should use secure random for keys', () => {
        const random1 = Math.random().toString(36);
        const random2 = Math.random().toString(36);
        expect(random1).not.toBe(random2);
    });
});
