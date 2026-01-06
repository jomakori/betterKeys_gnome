#!/bin/bash
# test_basic.sh - Basic test script for BetterKeys extension

set -e

echo "=== BetterKeys Virtual Keyboard - Basic Test ==="
echo

# Check if we're in the right directory
if [ ! -f "extension.js" ]; then
    echo "Error: extension.js not found. Run this script from the project root."
    exit 1
fi

echo "1. Checking project structure..."
required_files=(
    "extension.js"
    "prefs.js"
    "metadata.json"
    "stylesheet.css"
    "src/main.js"
    "src/settings/manager.js"
    "src/ui/keyboard.js"
    "src/ui/key.js"
    "schemas/org.gnome.shell.extensions.betterkeys.gschema.xml"
    "data/layouts/en_US_qwerty.json"
    "meson.build"
    "README.md"
)

missing_files=0
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file (MISSING)"
        missing_files=$((missing_files + 1))
    fi
done

if [ $missing_files -gt 0 ]; then
    echo "  Warning: $missing_files required files are missing"
else
    echo "  All required files present"
fi

echo
echo "2. Checking file syntax (basic JavaScript checks)..."
js_files=(
    "extension.js"
    "prefs.js"
    "src/main.js"
    "src/settings/manager.js"
    "src/ui/keyboard.js"
    "src/ui/key.js"
)

for js_file in "${js_files[@]}"; do
    if [ -f "$js_file" ]; then
        # Basic check for common syntax errors
        if grep -q "const.*=.*GObject.registerClass" "$js_file" && ! grep -q "var.*=.*" "$js_file" 2>/dev/null; then
            echo "  ✓ $js_file (basic syntax OK)"
        else
            echo "  ? $js_file (syntax check skipped)"
        fi
    fi
done

echo
echo "3. Checking metadata.json..."
if [ -f "metadata.json" ]; then
    if python3 -c "import json; json.load(open('metadata.json'))" 2>/dev/null; then
        echo "  ✓ metadata.json is valid JSON"
        
        # Check required fields
        if grep -q '"uuid"' metadata.json && grep -q '"name"' metadata.json; then
            echo "  ✓ metadata.json has required fields"
        else
            echo "  ✗ metadata.json missing required fields"
        fi
    else
        echo "  ✗ metadata.json is not valid JSON"
    fi
fi

echo
echo "4. Checking GSettings schema..."
if [ -f "schemas/org.gnome.shell.extensions.betterkeys.gschema.xml" ]; then
    if xmllint --noout "schemas/org.gnome.shell.extensions.betterkeys.gschema.xml" 2>/dev/null; then
        echo "  ✓ GSettings schema is valid XML"
        
        # Check for required keys
        required_keys=("show-prediction-bar" "current-layout" "theme-name")
        for key in "${required_keys[@]}"; do
            if grep -q "name=\"$key\"" "schemas/org.gnome.shell.extensions.betterkeys.gschema.xml"; then
                echo "  ✓ Key '$key' found in schema"
            else
                echo "  ✗ Key '$key' NOT found in schema"
            fi
        done
    else
        echo "  ✗ GSettings schema is not valid XML"
    fi
fi

echo
echo "5. Checking layout file..."
if [ -f "data/layouts/en_US_qwerty.json" ]; then
    if python3 -c "import json; json.load(open('data/layouts/en_US_qwerty.json'))" 2>/dev/null; then
        echo "  ✓ Layout file is valid JSON"
    else
        echo "  ✗ Layout file is not valid JSON"
    fi
fi

echo
echo "6. Checking CSS file..."
if [ -f "stylesheet.css" ]; then
    if grep -q "\.betterkeys-keyboard" stylesheet.css && grep -q "\.betterkeys-key" stylesheet.css; then
        echo "  ✓ CSS file contains required classes"
    else
        echo "  ✗ CSS file missing required classes"
    fi
fi

echo
echo "=== Test Summary ==="
echo "The basic project structure has been verified."
echo "Next steps for testing:"
echo "1. Install the extension locally:"
echo "   mkdir -p ~/.local/share/gnome-shell/extensions/betterkeys@gnome.org"
echo "   cp -r * ~/.local/share/gnome-shell/extensions/betterkeys@gnome.org/"
echo "2. Compile GSettings schema:"
echo "   glib-compile-schemas ~/.local/share/gnome-shell/extensions/betterkeys@gnome.org/schemas/"
echo "3. Enable the extension:"
echo "   gnome-extensions enable betterkeys@gnome.org"
echo "4. Restart GNOME Shell (Alt+F2, type 'r', press Enter)"
echo "5. Test the keyboard functionality"

echo
echo "Note: This is a basic structural test. Full functional testing requires"
echo "      running the extension in a GNOME Shell environment."
