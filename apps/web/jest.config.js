/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/**/*.spec.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@livenova/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '\\.(css|scss)$': '<rootDir>/test/style-mock.js',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};
