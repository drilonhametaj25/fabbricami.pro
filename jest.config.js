module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  // Exclude frontend code and E2E tests from Jest (tested by Vitest)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/client/',
    '/tests/e2e/',
    '/src/client/',
    '/src/ecommerce/',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/src/client/',
    '/src/ecommerce/',
    '/prisma/',
    '/dist/',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@server/(.*)$': '<rootDir>/src/server/$1',
    '^@client/(.*)$': '<rootDir>/src/client/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
};
