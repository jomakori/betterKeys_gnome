import js from '@eslint/js';

export default [
  {
    files: ['eslint.config.js', 'jest.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
    },
  },
  {
    files: ['prefs.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // GLib/GObject introspection via gi://
        GObject: 'readonly',
        Gtk: 'readonly',
        Gio: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
    },
  },
  {
    files: ['src/**/*.js', 'extension.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        // Node.js/CommonJS globals
        console: 'readonly',
        global: 'readonly',
        process: 'readonly',
        // GNOME Shell extension globals
        imports: 'readonly',
        log: 'readonly',
        logError: 'readonly',
        Me: 'readonly',
        _: 'readonly',
        // GNOME Shell APIs
        GLib: 'readonly',
        Gio: 'readonly',
        GObject: 'readonly',
        Clutter: 'readonly',
        Shell: 'readonly',
        St: 'readonly',
        Meta: 'readonly',
        Main: 'readonly',
        PanelMenu: 'readonly',
        PopupMenu: 'readonly',
        IBus: 'readonly',
        Atk: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single'],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-redeclare': 'off',
      'no-case-declarations': 'off',
      'no-useless-assignment': 'warn',
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'no-undef': 'warn',
      'no-dupe-class-members': 'warn',
    },
  },
];
