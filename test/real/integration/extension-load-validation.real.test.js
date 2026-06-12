const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_DIR = path.resolve(__dirname, '../../..');
const SRC_DIR = path.join(EXTENSION_DIR, 'src');
const SCHEMAS_DIR = path.join(EXTENSION_DIR, 'schemas');

function readJSON(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function findAllJSFiles(dir) {
    const files = [];
    function walk(d) {
        const entries = fs.readdirSync(d, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                walk(full);
            } else if (entry.name.endsWith('.js')) {
                files.push(full);
            }
        }
    }
    walk(dir);
    return files;
}

function stripImportExport(code) {
    return code
        .replace(/^(import|export)\s+.+$/gm, '// stripped')
        .replace(/from\s+['"].+['"];?\s*$/gm, '');
}

function getGNOMEShellVersion() {
    try {
        const ver = execSync('gnome-shell --version', { encoding: 'utf8' }).trim();
        const match = ver.match(/\d+\.\d+/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

describe('Extension Load Validation (Tier 1 — Build-Time E2E)', () => {

    describe('metadata.json', () => {
        let metadata;

        beforeAll(() => {
            metadata = readJSON(path.join(EXTENSION_DIR, 'metadata.json'));
        });

        test('is valid JSON', () => {
            expect(() => readJSON(path.join(EXTENSION_DIR, 'metadata.json'))).not.toThrow();
        });

        test('has required fields', () => {
            expect(metadata.uuid).toBeDefined();
            expect(metadata.name).toBeDefined();
            expect(metadata['shell-version']).toBeDefined();
        });

        test('uuid matches directory name convention', () => {
            expect(metadata.uuid).toMatch(/^[a-zA-Z0-9_-]+@[a-zA-Z0-9_.-]+$/);
        });

        test('shell-version is a non-empty array', () => {
            expect(Array.isArray(metadata['shell-version'])).toBe(true);
            expect(metadata['shell-version'].length).toBeGreaterThan(0);
        });

        test('shell-version contains only strings', () => {
            metadata['shell-version'].forEach(v => {
                expect(typeof v).toBe('string');
            });
        });

        test('has settings-schema (required by getSettings() on GNOME 45+)', () => {
            expect(metadata['settings-schema']).toBeDefined();
            expect(typeof metadata['settings-schema']).toBe('string');
            expect(metadata['settings-schema']).toMatch(/^org\.gnome\.shell\.extensions\./);
        });

        test('settings-schema matches the gschema.xml schema id', () => {
            const schemaContent = fs.readFileSync(
                path.join(SCHEMAS_DIR, 'org.gnome.shell.extensions.betterkeys.gschema.xml'), 'utf8');
            expect(schemaContent).toContain(`id="${metadata['settings-schema']}"`);
        });

        test('shell-version covers GNOME 45 through 50', () => {
            const versions = new Set(metadata['shell-version']);
            const required = ['45', '46', '47', '48', '49', '50'];
            required.forEach(v => {
                expect(versions.has(v)).toBe(true);
            });
        });

        test('shell-version matches current system GNOME if available', () => {
            const gnomeVersion = getGNOMEShellVersion();
            if (gnomeVersion) {
                const major = gnomeVersion.split('.')[0];
                expect(metadata['shell-version']).toContain(major);
            }
        });
    });

    describe('JavaScript syntax (ESM)', () => {
        const allJSFiles = findAllJSFiles(EXTENSION_DIR)
            .filter(f => !f.includes('/node_modules/') && !f.includes('/coverage/') && !f.includes('/build/'));

        const esmSourceFiles = allJSFiles.filter(f =>
            f === path.join(EXTENSION_DIR, 'extension.js') ||
            f.startsWith(SRC_DIR)
        );

        test.each(esmSourceFiles.map(f => [path.relative(EXTENSION_DIR, f), f]))(
            '%s has valid ESM import/export syntax',
            (relPath, fullPath) => {
                const code = fs.readFileSync(fullPath, 'utf8');
                const importStmts = code.match(/^import\s+.+$/gm) || [];
                for (const stmt of importStmts) {
                    expect(stmt).toMatch(/from\s+['"]/);
                }
                const exportStmts = code.match(/^export\s+.+$/gm) || [];
                for (const stmt of exportStmts) {
                    expect(stmt).toMatch(/^(export\s+(default\s+)?(const|let|var|class|function)|export\s+\{)/);
                }
            }
        );

        test('extension.js uses ESM import syntax', () => {
            const code = fs.readFileSync(path.join(EXTENSION_DIR, 'extension.js'), 'utf8');
            expect(code).toMatch(/^import\s+.*\s+from\s+/m);
            expect(code).not.toContain('imports.gi');
        });

        test('all src/ files use ESM import syntax (no legacy imports.*)', () => {
            const srcFiles = findAllJSFiles(SRC_DIR);
            const violations = [];
            for (const file of srcFiles) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('imports.gi') || content.includes('imports.misc') || content.includes('imports.ui') || content.includes('imports.gettext')) {
                    violations.push(path.relative(EXTENSION_DIR, file));
                }
            }
            if (violations.length > 0) {
                throw new Error(`Legacy imports.* found in ESM source files:\n${violations.join('\n')}`);
            }
        });
    });

    describe('prefs.js compatibility', () => {
        test('uses ESM format (required for GNOME 45+)', () => {
            const content = fs.readFileSync(path.join(EXTENSION_DIR, 'prefs.js'), 'utf8');
            expect(content).toMatch(/^import\s+/m);
            expect(content).toMatch(/^export\s+default\s+class/m);
            expect(content).not.toMatch(/imports\.misc\.extensionPreferences/);
        });

        test('imports ExtensionPreferences from correct resource', () => {
            const content = fs.readFileSync(path.join(EXTENSION_DIR, 'prefs.js'), 'utf8');
            expect(content).toContain("resource://org/gnome/Shell/Extensions/js/extensions/prefs.js");
        });
    });

    describe('extension.js structure (ESM class-based)', () => {
        let extContent;

        beforeAll(() => {
            extContent = fs.readFileSync(path.join(EXTENSION_DIR, 'extension.js'), 'utf8');
        });

        test('imports Extension base class from correct resource', () => {
            expect(extContent).toContain("import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js'");
        });

        test('uses export default class extending Extension', () => {
            expect(extContent).toMatch(/export\s+default\s+class\s+BetterKeysExtension\s+extends\s+Extension/);
        });

        test('has enable() method', () => {
            expect(extContent).toMatch(/enable\s*\(\)/);
        });

        test('has disable() method', () => {
            expect(extContent).toMatch(/disable\s*\(\)/);
        });

        test('imports KeyboardManager from src/main.js', () => {
            expect(extContent).toContain("import { KeyboardManager } from './src/main.js'");
        });

        test('creates KeyboardManager instance in enable()', () => {
            expect(extContent).toContain('new KeyboardManager(this)');
        });

        test('disconnects signal handlers in disable()', () => {
            expect(extContent).toContain('_signalHandlers.forEach');
            expect(extContent).toContain('object.disconnect');
        });

        test('does not use legacy ExtensionUtils or Me patterns', () => {
            expect(extContent).not.toContain('imports.misc.extensionUtils');
            expect(extContent).not.toContain('ExtensionUtils.getCurrentExtension');
            expect(extContent).not.toContain('Me.imports');
        });
    });

    describe('Import chain resolution (ESM)', () => {
        const allJSFiles = findAllJSFiles(SRC_DIR);

        test('all relative ESM imports resolve to existing files', () => {
            const missing = [];
            for (const file of allJSFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const relImports = content.match(/from\s+['"](\..\/[^'"]+)['"]/g) || [];
                const dir = path.dirname(file);
                for (const imp of relImports) {
                    const target = imp.match(/from\s+['"]([^'"]+)['"]/)[1];
                    const resolved = path.resolve(dir, target);
                    if (!fs.existsSync(resolved)) {
                        missing.push(`${path.relative(EXTENSION_DIR, file)} → ${target} (NOT FOUND: ${path.relative(EXTENSION_DIR, resolved)})`);
                    }
                }
            }
            if (missing.length > 0) {
                throw new Error(`Broken ESM imports:\n${missing.join('\n')}`);
            }
        });

        test('all named exports from imported modules actually exist', () => {
            const missing = [];
            for (const file of allJSFiles) {
                const content = fs.readFileSync(file, 'utf8');
                const dir = path.dirname(file);

                // Find named imports: import { X, Y } from './foo.js'
                const namedImportPattern = /import\s+\{\s*([^}]+)\}\s+from\s+['"](\..\/[^'"]+)['"]/g;
                let match;
                while ((match = namedImportPattern.exec(content)) !== null) {
                    const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
                    const targetPath = path.resolve(dir, match[2]);
                    if (!fs.existsSync(targetPath)) {
                        missing.push(`${path.relative(EXTENSION_DIR, file)} → ${match[2]} (file not found)`);
                        continue;
                    }
                    const targetContent = fs.readFileSync(targetPath, 'utf8');
                    for (const name of names) {
                        // Check for export const Name = / export function Name / export default
                        const exportPattern = new RegExp(`export\\s+(?:const|let|var|function|class)\\s+${name}\\b`, 'm');
                        const defaultPattern = new RegExp(`export\\s+default\\s+(?:class|function|const)\\s+${name}\\b`, 'm');
                        if (!exportPattern.test(targetContent) && !defaultPattern.test(targetContent)) {
                            missing.push(`${path.relative(EXTENSION_DIR, file)} imports "${name}" from ${match[2]} but target has no matching export`);
                        }
                    }
                }
            }
            if (missing.length > 0) {
                throw new Error(`Missing exports:\n${missing.join('\n')}`);
            }
        });
    });

    describe('Schema validation', () => {
        const schemaFile = path.join(SCHEMAS_DIR, 'org.gnome.shell.extensions.betterkeys.gschema.xml');

        test('schema file exists and is valid XML', () => {
            expect(fs.existsSync(schemaFile)).toBe(true);
            const content = fs.readFileSync(schemaFile, 'utf8');
            expect(content).toContain('<schemalist>');
            expect(content).toContain('</schemalist>');
            expect(content).toContain('org.gnome.shell.extensions.betterkeys');
        });

        test('schema compiles with glib-compile-schemas', () => {
            try {
                execSync(`glib-compile-schemas --dry-run ${SCHEMAS_DIR}`, { encoding: 'utf8' });
            } catch (error) {
                throw new Error(`Schema compilation failed: ${error.stderr}`);
            }
        });

        test('all SettingsManager keys exist in schema', () => {
            const settingsContent = fs.readFileSync(path.join(SRC_DIR, 'settings', 'manager.js'), 'utf8');
            const schemaContent = fs.readFileSync(schemaFile, 'utf8');

            const usedKeys = [];
            const keyPattern = /get_(?:boolean|string|int|value)\('([^']+)'\)/g;
            let match;
            while ((match = keyPattern.exec(settingsContent)) !== null) {
                usedKeys.push(match[1]);
            }

            const missing = [];
            for (const key of usedKeys) {
                if (!schemaContent.includes(`name="${key}"`)) {
                    missing.push(key);
                }
            }
            if (missing.length > 0) {
                throw new Error(`SettingsManager keys missing from schema:\n${missing.join('\n')}`);
            }
        });
    });

    describe('File completeness', () => {
        test('all required directories exist', () => {
            const required = ['src', 'src/ui', 'src/input', 'src/keyboard', 'src/settings',
                'src/utils', 'src/clipboard', 'src/emoji', 'schemas', 'data'];
            for (const dir of required) {
                expect(fs.existsSync(path.join(EXTENSION_DIR, dir))).toBe(true);
            }
        });

        test('src/main.js exists (entry point for extension.js import)', () => {
            expect(fs.existsSync(path.join(SRC_DIR, 'main.js'))).toBe(true);
        });

        test('stylesheet.css exists', () => {
            expect(fs.existsSync(path.join(EXTENSION_DIR, 'stylesheet.css'))).toBe(true);
        });

        test('data directory has layout files', () => {
            const layoutsDir = path.join(EXTENSION_DIR, 'data', 'layouts');
            const files = fs.readdirSync(layoutsDir);
            expect(files.length).toBeGreaterThan(0);
            files.forEach(f => {
                expect(f).toMatch(/\.json$/);
            });
        });
    });

    describe('Anti-pattern detection (ESM enforcement)', () => {
        const allJSFiles = findAllJSFiles(SRC_DIR);
        const allJSWithEntry = allJSFiles.concat([path.join(EXTENSION_DIR, 'extension.js')]);

        test('no file uses imports.gi (use gi:// imports instead)', () => {
            const violations = [];
            for (const file of allJSWithEntry) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('imports.gi')) {
                    violations.push(path.relative(EXTENSION_DIR, file));
                }
            }
            if (violations.length > 0) {
                throw new Error(`Legacy imports.gi found in:\n${violations.join('\n')}`);
            }
        });

        test('no file uses Me.imports (use relative ESM imports instead)', () => {
            const violations = [];
            for (const file of allJSWithEntry) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('Me.imports')) {
                    violations.push(path.relative(EXTENSION_DIR, file));
                }
            }
            if (violations.length > 0) {
                throw new Error(`Me.imports found in:\n${violations.join('\n')}`);
            }
        });

        test('no file uses imports.misc.extensionUtils or ExtensionUtils.getCurrentExtension', () => {
            const violations = [];
            for (const file of allJSWithEntry) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('imports.misc.extensionUtils') || content.includes('ExtensionUtils.getCurrentExtension')) {
                    violations.push(path.relative(EXTENSION_DIR, file));
                }
            }
            if (violations.length > 0) {
                throw new Error(`Legacy ExtensionUtils found in:\n${violations.join('\n')}`);
            }
        });

        test('no file uses imports.gettext (use resource:// gettext or placeholder)', () => {
            const violations = [];
            for (const file of allJSWithEntry) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('imports.gettext')) {
                    violations.push(path.relative(EXTENSION_DIR, file));
                }
            }
            if (violations.length > 0) {
                throw new Error(`Legacy imports.gettext found in:\n${violations.join('\n')}`);
            }
        });

        test('no file uses @ts-ignore or as any', () => {
            const violations = [];
            for (const file of allJSWithEntry) {
                const content = fs.readFileSync(file, 'utf8');
                if (content.includes('@ts-ignore') || content.includes('@ts-expect-error')) {
                    violations.push(path.relative(EXTENSION_DIR, file));
                }
            }
            if (violations.length > 0) {
                throw new Error(`Type suppression found in:\n${violations.join('\n')}`);
            }
        });
    });
});
