/** @type {import('jest').Config} */
const config = {
    testEnvironment: 'node',
    setupFiles: ['./test/setup.js'],
    collectCoverageFrom: [
        'src/**/*.js',
        'extension.js',
        'prefs.js',
        '!**/node_modules/**',
        '!**/test/**',
        '!**/mocks/**',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testMatch: [
        '**/test/**/*.test.js',
    ],
    moduleDirectories: ['node_modules', 'src'],
};

module.exports = config;
