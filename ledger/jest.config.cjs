/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Tests run against the sources of the common modules, so no build is needed first.
  moduleNameMapper: {
    '^budgets-cost-centers-core$': '<rootDir>/../core/src',
    '^budgets-cost-centers-shared$': '<rootDir>/../shared/src',
  },
  // msw 2 depends on packages that ship as ESM only. Jest cannot require ESM before Node 24.9, so these packages are
  // compiled to CommonJS; everything else in node_modules stays untouched.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
    '^.+\\.m?js$': ['ts-jest', { tsconfig: { allowJs: true, module: 'commonjs' }, isolatedModules: true }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(rettime|until-async|@open-draft/deferred-promise)/)'],
};
