# Makefile for betterKeys GNOME Shell extension

.PHONY: all build clean install uninstall test test-unit test-integration test-performance test-compatibility test-accessibility test-security coverage package lint audit check help

# Default target
all: build

# Build using meson
build:
	@echo "Building betterKeys..."
	@sudo rm -rf build
	@meson setup build
	@meson compile -C build

# Clean build directory
clean:
	@echo "Cleaning build directory..."
	@rm -rf build
	@rm -rf coverage
	@rm -f test-output-*.txt

# Install extension locally as user extension
install: build
	@echo "Installing extension as user extension..."
	@mkdir -p ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com
	@cp -r extension.js prefs.js metadata.json stylesheet.css src/ data/ schemas/ ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com/
	@glib-compile-schemas ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com/schemas/
	@echo "Extension installed to ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com"
	@echo "Restart GNOME Shell to activate."

# Uninstall extension
uninstall:
	@echo "Uninstalling extension..."
	@rm -rf ~/.local/share/gnome-shell/extensions/betterkeys@jomakori.github.com
	@echo "Extension uninstalled."

# Reload extension without restarting GNOME Shell
# Tries `gnome-extensions` first, falls back to a `gdbus` Eval reload
reload:
	@echo "Reloading extension..."
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		gnome-extensions disable betterkeys@jomakori.github.com && \
		sleep 0.5 && \
		gnome-extensions enable betterkeys@jomakori.github.com; \
	else \
		echo "gnome-extensions not found, attempting gdbus Eval..."; \
		gdbus call --session --dest org.gnome.Shell \
		  --object-path /org/gnome/Shell \
		  --method org.gnome.Shell.Eval \
		  "imports.ui.main.extensionManager.reloadExtension('betterkeys@jomakori.github.com')" || true; \
	fi

# Run all tests with Jest
test:
	@echo "Running all tests with Jest..."
	@npx jest

# Run unit tests
test-unit:
	@echo "Running unit tests..."
	@npx jest test/unit/

# Run integration tests
test-integration:
	@echo "Running integration tests..."
	@npx jest test/integration/

# Run compatibility tests
test-compatibility:
	@echo "Running compatibility tests..."
	@npx jest test/compatibility/

# Run accessibility tests
test-accessibility:
	@echo "Running accessibility tests..."
	@npx jest test/accessibility/

# Run security tests
test-security:
	@echo "Running security tests..."
	@npx jest test/security/

# Run performance benchmarks (not Jest)
test-performance:
	@echo "Running performance benchmarks..."
	@node test/performance/*.bench.js

# Generate coverage report with Jest
coverage:
	@echo "Generating coverage report..."
	@npx jest --coverage

# Package extension for distribution
package: clean
	@echo "Packaging extension..."
	@mkdir -p dist
	@zip -r dist/betterkeys-$(shell date +%Y%m%d).zip . \
		-x "*.git*" \
		-x "build/*" \
		-x "dist/*" \
		-x "coverage/*" \
		-x "test-output-*.txt" \
		-x "*.swp" \
		-x "*.log" \
		-x "node_modules/*"
	@echo "Package created: dist/betterkeys-$(shell date +%Y%m%d).zip"

# Lint JavaScript files (if eslint is configured)
lint:
	@echo "Linting JavaScript files..."
	@if command -v eslint >/dev/null 2>&1; then \
		eslint src/ test/; \
	else \
		echo "eslint not installed, skipping lint."; \
	fi

# Run security audit (npm audit if package.json exists)
audit:
	@echo "Running security audit..."
	@if [ -f "package.json" ]; then \
		npm audit || true; \
	else \
		echo "No package.json, skipping npm audit."; \
	fi

# Quick check: build, test, lint
check: build test lint

# Help
help:
	@echo "betterKeys Makefile targets:"
	@echo "  all          - Build extension (default)"
	@echo "  build        - Build using meson"
	@echo "  clean        - Remove build and test artifacts"
	@echo "  install      - Install extension locally"
	@echo "  uninstall    - Uninstall extension"
	@echo "  test         - Run all test suites with Jest"
	@echo "  test-unit    - Run unit tests only"
	@echo "  test-integration - Run integration tests"
	@echo "  test-compatibility - Run compatibility tests"
	@echo "  test-accessibility - Run accessibility tests"
	@echo "  test-security - Run security tests"
	@echo "  test-performance - Run performance benchmarks"
	@echo "  coverage     - Generate test coverage report"
	@echo "  package      - Create distribution zip"
	@echo "  lint         - Lint JavaScript files"
	@echo "  audit        - Security audit"
	@echo "  check        - Build, test, lint"
	@echo "  help         - Show this help"
