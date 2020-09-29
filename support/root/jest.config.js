const path = require('path');

module.exports = {
  ...require('../jest/jest.config'),
  projects: [
    {
      displayName: { name: 'playwright' },
      runner: 'node',
      rootDir: path.resolve(__dirname, 'packages'),
    },
    {
      displayName: { name: 'playwright', color: 'cyan' },
      runner: '@jestify/unit',
      rootDir: path.resolve(__dirname, 'examples'),
      testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
    },
    {
      displayName: { name: 'playwright', color: 'blue' },
      runner: '@jestify/e2e',
      rootDir: path.resolve(__dirname, 'examples'),
      testMatch: [
        '**/__tests__/**/e2e/**/*.[jt]s?(x)',
        '**/e2e/**/?(*.)+(spec|test).[jt]s?(x)',
      ],
    },
  ],
  coverageThreshold: {
    global: {
      statements: 60,
    },
  },
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.dts.ts',
    '!**/theme-styles.ts',
    '!**/styles.ts',
    '!**/__mocks__/**',
    '!**/__tests__/**',
    '!**/__dts__/**',
    '!**/__fixtures__/**',
    '!support/**',
  ],
  coverageReporters: ['json', 'lcov', 'text-summary', 'clover'],
  collectCoverage: true,
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
  testRunner: 'jest-circus/runner',
  testPathIgnorePatterns: ['<rootDir>/support/', '/node_modules/'],
};
