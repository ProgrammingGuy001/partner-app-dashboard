module.exports = function (api) {
  api.cache(true);
  const isProduction = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      'react-native-worklets/plugin',

      ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
    ],
  };
};