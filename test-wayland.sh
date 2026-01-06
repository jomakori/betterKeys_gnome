#!/bin/bash
# test-wayland.sh - Test BetterKeys extension in a nested GNOME Shell on Wayland

set -e

EXTENSION_UUID="betterkeys@jomakori.github.com"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"

echo "=========================================="
echo "BetterKeys Wayland Testing Script"
echo "=========================================="
echo ""

# Check if extension is installed
if [ ! -d "$EXTENSION_DIR" ]; then
    echo "❌ Extension not installed. Run 'make install' first."
    exit 1
fi

echo "✓ Extension found at: $EXTENSION_DIR"
echo ""

# Check if GNOME Shell is running
if pgrep -x "gnome-shell" > /dev/null; then
    echo "⚠️  GNOME Shell is currently running."
    echo ""
    echo "To test the extension, you have two options:"
    echo ""
    echo "Option 1: Restart GNOME Shell (X11 only)"
    echo "  Press Alt+F2, type 'r', and press Enter"
    echo ""
    echo "Option 2: Start a nested GNOME Shell (Wayland)"
    echo "  Run: GNOME_SHELL_EXTENSION_PREFS=1 dbus-run-session gnome-shell --nested"
    echo ""
    echo "Option 3: Log out and log back in"
    echo "  This will fully reload GNOME Shell with the extension"
    echo ""
else
    echo "✓ GNOME Shell is not running"
    echo ""
    echo "Starting nested GNOME Shell for testing..."
    echo ""
    
    # Try to start nested GNOME Shell
    if command -v gnome-shell &> /dev/null; then
        export GDK_BACKEND=wayland
        export WAYLAND_DISPLAY=wayland-1
        
        echo "Starting nested GNOME Shell..."
        dbus-run-session gnome-shell --nested 2>&1 || {
            echo "❌ Failed to start nested GNOME Shell"
            echo ""
            echo "Alternative: Log out and log back in to test the extension"
            exit 1
        }
    else
        echo "❌ GNOME Shell not found"
        exit 1
    fi
fi
