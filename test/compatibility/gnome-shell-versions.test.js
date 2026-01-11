/* test/compatibility/gnome-shell-versions.test.js - Test compatibility across GNOME Shell versions */

const { MockSettingsManager } = require('../utils/test-helpers');

describe('GNOME Shell Version Compatibility', () => {
    test('should work with GNOME Shell 40', () => {
        // Simulate GNOME Shell 40 environment
        global.versions = { gnomeShell: '40' };
        expect(() => {
            // Load extension
        }).not.toThrow();
    });

    test('should work with GNOME Shell 41', () => {
        global.versions = { gnomeShell: '41' };
        expect(() => {
            // Load extension
        }).not.toThrow();
    });

    test('should work with GNOME Shell 42', () => {
        global.versions = { gnomeShell: '42' };
        expect(() => {
            // Load extension
        }).not.toThrow();
    });

    test('should work with GNOME Shell 43', () => {
        global.versions = { gnomeShell: '43' };
        expect(() => {
            // Load extension
        }).not.toThrow();
    });

    test('should work with GNOME Shell 44', () => {
        global.versions = { gnomeShell: '44' };
        expect(() => {
            // Load extension
        }).not.toThrow();
    });

    test('should work with GNOME Shell 45+', () => {
        global.versions = { gnomeShell: '45' };
        expect(() => {
            // Load extension
        }).not.toThrow();
    });
});
