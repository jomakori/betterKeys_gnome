/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'node',
    setupFiles: ['./test/setup.js'],

    // Include both mock-based and real tests
    testMatch: [
        '**/test/unit/**/*.test.js',
        '**/test/real/unit/**/*.real.test.js',
        '**/test/real/integration/**/*.real.test.js',
        '**/test/integration/**/*.test.js',
        '**/test/compatibility/**/*.test.js',
        '**/test/accessibility/**/*.test.js',
        '**/test/security/**/*.test.js',

    ],

    // Code coverage configuration
    collectCoverageFrom: [
        'src/**/*.js',
        'extension.js',
        'prefs.js',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/mocks/**',
    ],

    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],

    // Report coverage thresholds (start low, increase as we add more real tests)
    coverageThreshold: {
        global: {
            branches: 10,
            functions: 10,
            lines: 10,
            statements: 10
        }
    },

    moduleDirectories: ['node_modules', 'src'],

    // Verbose output for better debugging
    verbose: true,

    // Timeout for async tests
    testTimeout: 10000,

    // Show coverage on failure
    collectCoverage: false,

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks between tests
    restoreMocks: true,

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/build/',
        '/test/performance/',
    ],
};

module.exports = config;
