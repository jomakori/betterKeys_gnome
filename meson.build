project('betterkeys', version: '1.0')

extension_dir = join_paths(
  get_option('datadir'),
  'gnome-shell/extensions/betterkeys@jomakori.github.com'
)

# Install main extension files
install_data(
  'extension.js',
  'prefs.js',
  'stylesheet.css',
  'metadata.json',
  install_dir: extension_dir
)

# Install all source files recursively
install_subdir(
  'src',
  install_dir: extension_dir
)

# Install data files recursively
install_subdir(
  'data',
  install_dir: extension_dir
)
