# BetterKeys Virtual Keyboard

A production-grade GNOME Shell virtual keyboard extension with advanced features.

## Features

- **Basic Keyboard**: Standard QWERTY layout with dynamic sizing
- **Touch Input**: Optimized for tablet and touch devices
- **Gesture Support**: Swipe gestures for navigation and editing
- **Predictive Text**: Context-aware word prediction and auto-correction
- **Multi-language**: Support for multiple keyboard layouts
- **Theming**: Customizable themes (Default, Dark, High Contrast)
- **Accessibility**: High contrast, enlarged keys, screen reader compatibility
- **Application-specific Layouts**: Custom layouts for different applications

## Architecture

The extension follows a modular architecture:

```
.
├── extension.js              # Main entry point
├── prefs.js                  # Preferences UI
├── src/
│   ├── main.js              # Keyboard manager
│   ├── ui/                  # UI components
│   │   ├── keyboard.js      # Main keyboard UI
│   │   └── key.js           # Individual key component
│   ├── settings/            # Settings management
│   │   └── manager.js       # GSettings wrapper
│   └── input/               # Input handling (future)
├── data/layouts/            # Keyboard layout definitions
├── schemas/                 # GSettings schemas
└── stylesheet.css           # CSS styling
```

## Installation

### Development Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/betterkeys.git
   cd betterkeys
   ```

2. Install to local extensions directory:
   ```bash
   mkdir -p ~/.local/share/gnome-shell/extensions/betterkeys@gnome.org
   cp -r * ~/.local/share/gnome-shell/extensions/betterkeys@gnome.org/
   ```

3. Compile GSettings schema:
   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/betterkeys@gnome.org/schemas/
   ```

4. Enable the extension:
   ```bash
   gnome-extensions enable betterkeys@gnome.org
   ```

5. Restart GNOME Shell (Alt+F2, type 'r', press Enter)

### Using Meson (Recommended)

```bash
meson build
ninja -C build install
```

## Usage

1. Enable the extension in GNOME Extensions
2. Configure settings via GNOME Extensions app or `gnome-extensions prefs betterkeys@gnome.org`
3. The keyboard can be toggled via a keyboard shortcut (to be configured)

## Configuration

### GSettings Keys

- `show-prediction-bar`: Show/hide prediction bar
- `auto-correction-enabled`: Enable/disable auto-correction
- `haptic-feedback-enabled`: Enable/disable haptic feedback
- `key-press-sound-enabled`: Enable/disable key press sound
- `current-layout`: Current keyboard layout
- `theme-name`: Active theme (default, dark, high-contrast)
- `application-layouts`: Application-specific layout mappings

### Example: Set theme to dark

```bash
gsettings set org.gnome.shell.extensions.betterkeys theme-name 'dark'
```

## Development

### Prerequisites

- GNOME Shell 40+
- GJS (GNOME JavaScript bindings)
- Meson build system
- GLib development tools

### Building

```bash
meson setup build
meson compile -C build
```

### Testing

Run the extension in a nested GNOME Shell session:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

## Roadmap

### Phase 1 (MVP)
- [x] Basic keyboard rendering
- [x] Key input handling
- [x] GSettings integration
- [x] Basic theming
- [ ] IBus integration for text input
- [ ] Auto-show/hide based on focus

### Phase 2 (Advanced Features)
- [ ] Gesture recognition (swipe, long-press)
- [ ] Predictive text engine
- [ ] Multi-language support
- [ ] Clipboard history
- [ ] Emoji library

### Phase 3 (Optimization & Polish)
- [ ] Performance optimization
- [ ] Advanced ML prediction
- [ ] Voice input integration
- [ ] Cloud sync for user dictionary

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

GPL-3.0 or later

## Acknowledgments

- GNOME Shell extension developers
- GJS and Clutter/St documentation
- Open source virtual keyboard projects
