---
name: betterkeys-project
description: Project-specific knowledge for the betterKeys GNOME Shell extension. Use when working on, debugging, testing, or building this extension. Covers architecture, common failure modes, E2E validation, build pipeline, and debugging workflows.
---

# betterKeys GNOME Extension — Project Knowledge

## Architecture

```
betterkeys@jomakori.github.com/
├── extension.js          # Entry point: init(), enable(), disable()
├── prefs.js              # Preferences window (Adw.PreferencesPage)
├── metadata.json         # Extension metadata (UUID, shell-version, etc.)
├── stylesheet.css        # CSS with CSS custom properties for theming
├── schemas/
│   └── org.gnome.shell.extensions.betterkeys.gschema.xml
├── src/
│   ├── main.js           # KeyboardManager (GObject class, orchestrator)
│   ├── ui/               # Keyboard UI, key rendering, window management, themes
│   ├── input/            # Key press handling, gestures, ibus, voice-input placeholder
│   ├── keyboard/         # Layout manager, layout adapter
│   ├── prediction/       # Predictive text engine
│   ├── settings/         # GSettings wrapper (idempotent schema loading)
│   ├── clipboard/        # Clipboard history
│   ├── emoji/            # Emoji library
│   ├── security/         # Input validation/sanitization
│   ├── utils/            # EventEmitter, helpers
│   └── performance/      # Performance monitoring
├── data/
│   ├── layouts/          # Keyboard layout JSON files (qwerty, dvorak, colemak)
│   ├── emoji/            # Emoji catalog JSON
│   ├── special-chars/    # Special characters JSON
│   ├── themes/           # Theme definitions
│   └── vocabularies/     # Language vocabularies for prediction
└── test/
    ├── setup.js          # Global Jest setup (mocks imports.gi.*, etc.)
    ├── unit/             # Mock-based unit tests
    ├── integration/      # Mock-based integration tests
    ├── real/             # Real functionality tests (not mock-based)
    │   ├── unit/         # Tests that validate actual source files
    │   └── integration/  # EMPTY — no E2E tests exist yet
    ├── compatibility/    # GNOME version compatibility matrix tests
    ├── accessibility/    # ATK/ATSPI accessibility tests
    └── security/         # Security audit tests
```

### Extension Loading Flow (GNOME Shell)

1. GNOME Shell reads `metadata.json` → checks `shell-version` match
2. If version mismatch → state: OUT OF DATE → extension NOT loaded
3. If version matches → loads `extension.js` as a GJS module
4. Shell calls `init()` → `enable()` → `disable()` lifecycle

### Import Chain

```
extension.js
  → imports.misc.extensionUtils → Me
  → Me.imports.src.main → KeyboardManager
    → Me.imports.src.ui.keyboard → KeyboardUI
    → Me.imports.src.settings.manager → SettingsManager
    → Me.imports.src.keyboard.manager → KeyboardCoreManager
```

## Critical Failure Modes (Checklist)

### 1. shell-version mismatch (MOST COMMON — SILENT FAILURE)
- **Symptom**: `gnome-extensions info` shows `State: OUT OF DATE`
- **Symptom**: Extension appears enabled but code never executes (no log messages)
- **Check**: `gnome-extensions info <uuid>` — compare `shell-version` in metadata.json vs `gnome-shell --version`
- **Fix**: Update `metadata.json` `shell-version` array to include current GNOME Shell major version
- **Current state**: Dev says `["49"]`, installed says `["40"-"46"]`, system runs **GNOME 50.2** → BOTH WRONG

### 2. Import errors (GJS module system)
- **Symptom**: Extension shows error in Looking Glass (Alt+F2 → lg → Errors tab)
- **Common causes**:
  - `imports.misc.extensionUtils` used at module top-level instead of inside functions
  - ES6 `import`/`export` syntax (GJS uses `imports.*` or `const { X } = imports.gi`)
  - Missing `Me.imports.src.xxx` path (file doesn't exist or wrong path)
  - Circular imports between modules
- **Check**: Run `node -e "const fs = require('fs'); const code = fs.readFileSync('extension.js','utf8'); new Function(code)"` for basic syntax

### 3. GSettings schema not compiled
- **Symptom**: `Settings schema 'org.gnome.shell.extensions.betterkeys' is not installed`
- **Check**: `ls ~/.local/share/glib-2.0/schemas/gschemas.compiled` exists and contains the schema
- **Fix**: `glib-compile-schemas <extension-dir>/schemas/`

### 4. Extension installed at wrong path
- GNOME Shell looks in:
  - `~/.local/share/gnome-shell/extensions/<uuid>/` (user install)
  - `/usr/share/gnome-shell/extensions/<uuid>/` (system install)
  - `/usr/local/share/gnome-shell/extensions/<uuid>/` (local system install)
- **Priority**: User path overrides system paths
- **Current state**: Installed at `/usr/local/...` (root-owned) but NOT at `~/.local/...`
- **Check**: `ls -d ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com/`

### 5. Missing source files in installed extension
- meson `install_subdir('src', ...)` should recursively copy all source files
- **Check**: Compare `find <dev>/src -name '*.js' | sort` vs `find <installed>/src -name '*.js' | sort`
- **Current state**: Installed src/ has files but verify all subdirectories (clipboard/, emoji/, etc.)

### 6. D-Bus activation failures
- **Symptom**: `Gio.DBusError` in journal
- **Check**: `journalctl --user -n 100 | grep -i "betterkeys\|dbus\|extension"`

## Test Architecture

### Mock-Based Tests (test/unit/, test/integration/)
- `test/setup.js` provides global `imports.gi.*` mocks (GObject, GLib, Gio, St, etc.)
- 158+ tests pass but test mock code, NOT real code
- **Known limitation**: Creates false confidence — real GJS loading errors undetected

### Real Functionality Tests (test/real/)
- `test/real/unit/` — Validates actual source files (syntax, structure, API contract)
- `test/real/integration/` — **EMPTY** — E2E validation tests NEEDED HERE
- Approach: Load source files as text, validate syntax/patterns, test extracted core logic

## E2E Validation (What Tests Should Cover)

### Tier 1 — Build-Time Validation (fast, CI-friendly)
1. **metadata.json validation**: shell-version covers current GNOME, UUID is valid, JSON parseable
2. **Schema validation**: `.gschema.xml` is valid XML, compiles with `glib-compile-schemas`
3. **Syntax validation**: All `.js` files parse successfully (no GJS-specific syntax errors)
4. **Import chain validation**: Entry point → `init()` → `enable()` chain resolves correctly
5. **Filesystem completeness**: All files referenced in `extension.js` exist on disk

### Tier 2 — Runtime Validation (requires GNOME Shell)
1. **Extension loads without errors**: `gnome-extensions enable` succeeds
2. **Extension appears in enabled list**: `gsettings get org.gnome.shell enabled-extensions`
3. **No errors in Looking Glass**: `gdbus call ... Eval` to check error state
4. **Extension can be disabled cleanly**: `gnome-extensions disable` succeeds
5. **Preferences window loads**: `gnome-extensions prefs <uuid>` launches without crash

### Tier 3 — Functional Validation
1. Keyboard UI renders when triggered
2. Key presses produce correct output
3. Layout switching works
4. Theme changes apply
5. Settings persist across disable/enable

## Build Pipeline

```bash
# Build (meson)
make build          # meson setup build && meson compile -C build

# Install (user)
make install        # Copies files to ~/.local/share/gnome-shell/extensions/<uuid>/

# Install (system via meson)
cd build && meson install  # Installs to /usr/local/share/...

# Reload extension
make reload         # gnome-extensions disable && enable

# Test
make test           # npx jest
make test-unit      # npx jest test/unit/
make test-integration # npx jest test/integration/
make test-compatibility # npx jest test/compatibility/

# Manual enable/disable
gnome-extensions enable betterkeys@jomakori.github.com
gnome-extensions disable betterkeys@jomakori.github.com
gnome-extensions info betterkeys@jomakori.github.com
```

## Debugging Workflow

1. **Check version match**: `gnome-shell --version` → 50.2 → metadata needs `["50"]`
2. **Check extension state**: `gnome-extensions info betterkeys@jomakori.github.com`
3. **Check extension is user-installed**: `ls ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com/`
4. **Check for Looking Glass errors**: Alt+F2 → `lg` → Errors tab, OR `journalctl --user -f | grep -i betterkey`
5. **Check schemas**: `ls ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com/schemas/gschemas.compiled`
6. **Enable verbose logging**: Add `log('[betterKeys] ...')` at each step of enable()
7. **Test syntax in isolation**: `node -c extension.js` (for basic JS — won't catch GJS imports)
8. **Check D-Bus**: `gdbus call --session --dest org.gnome.Shell --object-path /org/gnome/Shell --method org.gnome.Shell.Eval "imports.ui.main.extensionManager.lookup('betterkeys@jomakori.github.com')"`

## Common Fixes

### Fix 1: Update shell-version for current GNOME

```bash
GNOME_VER=$(gnome-shell --version | grep -oP '\d+\.\d+' | cut -d. -f1)
# Edit metadata.json: "shell-version": ["$GNOME_VER"]
```

### Fix 2: Reinstall to user path

```bash
make install  # Installs to ~/.local/...
# Then restart GNOME Shell (Alt+F2 → r on X11, logout/login on Wayland)
```

### Fix 3: Compile schemas

```bash
glib-compile-schemas ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com/schemas/
```

## Git History

- `37d97eb` — WIP: Fixing Keyboard functionality
- `51ee622` — WIP: Keyboard implementation done
- `a623855` — Add pre-commit lint hook
- `1e99613` — Initial commit (scaffold)

## Current Known Issues (as of last session)

1. **shell-version is `["49"]` but GNOME Shell is 50.2** → Extension will not load
2. **Extension installed at `/usr/local/` not `~/.local/`** → May conflict with user install
3. **No E2E validation tests** → `test/real/integration/` is empty
4. **Mock-based tests give false confidence** → 158 passing but real code untested
5. **No schema compilation in meson.build** → meson install doesn't compile schemas
6. **`make install` uses sudo for build** → Installs to system path with root ownership
