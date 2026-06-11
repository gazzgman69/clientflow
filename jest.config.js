/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      // Transpile only — the app runs via esbuild without type-checking, and the
      // codebase has many pre-existing type errors. Matching that here lets the
      // runtime behaviour (e.g. tenant fail-closed guards) be tested directly.
      isolatedModules: true,
    }],
  },
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.test.ts',
    '!server/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};