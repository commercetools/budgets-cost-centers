const mcAppConfig = require('@commercetools-frontend/eslint-config-mc-app');

module.exports = [
  // Build output of mc-scripts (gitignored) is not source.
  // src/core is a generated copy of ../core/src (tools/sync-view-core.mjs), linted there.
  { ignores: ['public/**', 'dist/**', 'src/core/**'] },
  ...mcAppConfig,
  {
    files: ['eslint.config.js'],
    rules: { 'import/extensions': 'off' },
  },
];
