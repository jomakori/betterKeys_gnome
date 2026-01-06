# meson.build - Build configuration for BetterKeys Virtual Keyboard extension

project('betterkeys', 'c', version: '1.0')

# Dependencies
gnome = import('gnome')

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

# Install extension files
install_subdir('.',
  install_dir: join_paths(get_option('datadir'), 'gnome-shell/extensions/betterkeys@jomakori.github.com'),
  exclude_files: ['meson.build', 'meson.options', 'README.md', 'CHANGELOG.md']
)

# Compile and install GSettings schema
gnome.compile_schemas(
  build_by_default: true,
  depend_files: schema_files
)

install_data(schema_files,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)

# Post-install script to enable the extension
meson.add_install_script('post_install.sh')
