// Jest on the Merchant Center preset, with the Nimbus JSDOM polyfills. [BCC-VIEW-10]
// https://docs.commercetools.com/merchant-center-customizations/development/testing

const preset = require('@commercetools-frontend/jest-preset-mc-app/jest-preset-for-typescript');

/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
module.exports = {
  preset: '@commercetools-frontend/jest-preset-mc-app/typescript',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  // Nimbus polyfills come first, as its testing setup page asks.
  setupFiles: [
    '@commercetools/nimbus/setup-jsdom-polyfills',
    ...preset.setupFiles,
  ],
  setupFilesAfterEnv: [
    ...preset.setupFilesAfterEnv,
    '<rootDir>/jest.setup-after-env.js',
  ],
  moduleNameMapper: preset.moduleNameMapper,
};
