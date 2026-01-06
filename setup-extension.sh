#!/bin/bash
# setup-extension.sh - Complete setup and enable BetterKeys extension

set -e

EXTENSION_UUID="betterkeys@jomakori.github.com"
EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "BetterKeys Extension Setup"
echo "=========================================="
echo ""

# Step 1: Install extension files
echo "Step 1: Installing extension files..."
bash "$PROJECT_DIR/install.sh"

echo ""
echo "Step 2: Checking GNOME Shell..."

# Check if GNOME Shell is running
if ! pgrep -x "gnome-shell" > /dev/null; then
    echo "⚠️  GNOME Shell is not running"
    echo "The extension will be available after you log in"
    exit 0
fi

echo "✓ GNOME Shell is running (PID: $(pgrep -x gnome-shell))"

# Step 3: Try to enable extension
echo ""
echo "Step 3: Attempting to enable extension..."

# First, try direct enable
if gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null; then
    echo "✓ Extension enabled successfully!"
    exit 0
fi

# If direct enable fails, try restarting GNOME Shell
echo "⚠️  Direct enable failed. Attempting to restart GNOME Shell..."

# Check if we're on X11 or Wayland
if [ "$XDG_SESSION_TYPE" = "x11" ]; then
    echo "Detected X11 session"
    echo "Restarting GNOME Shell..."
    
    # Restart GNOME Shell on X11
    DISPLAY=:0 gnome-shell --replace &
    sleep 3
    
    # Try to enable again
    if gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null; then
        echo "✓ Extension enabled successfully after restart!"
        exit 0
    fi
elif [ "$XDG_SESSION_TYPE" = "wayland" ]; then
    echo "Detected Wayland session"
    echo ""
    echo "⚠️  Cannot automatically restart GNOME Shell on Wayland"
    echo ""
    echo "To enable the extension, please:"
    echo "1. Log out completely"
    echo "2. Log back in"
    echo ""
    echo "Or use the GNOME Extensions app to enable it manually"
    exit 0
else
    echo "Unknown session type: $XDG_SESSION_TYPE"
    echo ""
    echo "Please restart GNOME Shell or log out and log back in"
    exit 0
fi

echo ""
echo "❌ Failed to enable extension automatically"
echo ""
echo "Please try one of the following:"
echo "1. Restart GNOME Shell (Alt+F2, type 'r', press Enter)"
echo "2. Log out and log back in"
echo "3. Use the GNOME Extensions app to enable it"
echo ""
