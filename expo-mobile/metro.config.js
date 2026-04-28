const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.transformer.minifierPath = require.resolve('metro-minify-terser');
config.transformer.minifierConfig = {
  compress: {
    drop_console: true,
    dead_code: true,
    unused: true,
  },
  mangle: true,
};

module.exports = withNativeWind(config, {
  input: './src/global.css',
  inlineRem: 16,
});
