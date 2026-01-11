# meson.build - Build configuration for betterKeys Virtual Keyboard extension

project('betterkeys', version: '1.0')

# Dependencies
gnome = import('gnome')

# Set installation directory to user's local extensions directory
extension_dir = join_paths(get_option('datadir'), 'gnome-shell/extensions/betterkeys@jomakori.github.com')

# Extension files
extension_sources = [
  'extension.js',
  'prefs.js',
  'stylesheet.css',
  'src/main.js',
  'src/settings/manager.js',
  'src/ui/keyboard.js',
  'src/ui/key.js'
]

# Data files
data_files = [
  'data/layouts/en_US_qwerty.json'
]

# Schema files
schema_files = [
  'schemas/org.gnome.shell.extensions.betterkeys.gschema.xml'
]

# Install main extension files
install_data(extension_sources,
  install_dir: join_paths(get_option('datadir'), 'gnome-shell/extensions/betterkeys@jomakori.github.com')
)

# Install data files
install_subdir('data',
  install_dir: join_paths(get_option('datadir'), 'gnome-shell/extensions/betterkeys@jomakori.github.com')
)

# Install source files
install_subdir('src',
  install_dir: join_paths(get_option('datadir'), 'gnome-shell/extensions/betterkeys@jomakori.github.com')
)

# Install metadata
install_data('metadata.json',
  install_dir: join_paths(get_option('datadir'), 'gnome-shell/extensions/betterkeys@jomakori.github.com')
)

# Compile and install GSettings schema
gnome.compile_schemas(
  build_by_default: true,
  depend_files: schema_files
)

install_data(schema_files,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)
