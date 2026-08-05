/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../test/setup-env.ts'],
  moduleNameMapper: {
    '^@livenova/shared$': '<rootDir>/../../../packages/shared/src/index.ts',
  },
  // NFR-23 — credit and TTS metering carry the money; they are held to a higher
  // bar than the rest of the codebase.
  coverageThreshold: {
    './modules/credit/credit.service.ts': {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};
