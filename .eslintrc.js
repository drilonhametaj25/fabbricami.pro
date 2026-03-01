module.exports = {
  root: true,
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    }],
    'no-console': 'off',
  },
  overrides: [
    // TypeScript files (server)
    {
      files: ['src/server/**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      rules: {
        // Allow require() in server code (dynamic imports, etc.)
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    // Test files - more lenient with unused vars (test helpers, mocks, etc.)
    {
      files: ['tests/**/*.ts', 'tests/**/*.test.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      env: {
        jest: true,
      },
      rules: {
        // Test files often have unused imports for mocks, types, etc.
        '@typescript-eslint/no-unused-vars': ['warn', {
          argsIgnorePattern: '^_|^callback$|^options$|^i$|^index$|^status$',
          varsIgnorePattern: '^_|^result$|^prisma$|^DeepMockProxy$|^mockFactories$|^Prisma$|^emailQueue$|^shopCheckoutService$|^afterEach$|^AlertService$|^BomService$|^BomExplosionItem$|^UserRole$|^createMock',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^error$|^e$|^err$',
        }],
        // Allow any in test files
        '@typescript-eslint/no-explicit-any': 'off',
        // Allow Function type in test utilities
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-unsafe-function-type': 'off',
        // Allow require() imports in test files
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    // Vue files (client)
    {
      files: ['src/client/**/*.vue'],
      parser: 'vue-eslint-parser',
      parserOptions: {
        parser: '@typescript-eslint/parser',
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      extends: [
        'plugin:vue/vue3-recommended',
      ],
      rules: {
        'vue/multi-word-component-names': 'off',
        'vue/no-v-html': 'warn',
        'vue/require-default-prop': 'off',
        // Allow common error variable names in catch blocks (often used in templates)
        '@typescript-eslint/no-unused-vars': ['error', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^error$|^e$|^err$',
        }],
        // Disable useless-catch (Vue uses catch for user-friendly error handling)
        'no-useless-catch': 'off',
      },
    },
    // TypeScript files (client)
    {
      files: ['src/client/**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      env: {
        browser: true,
      },
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_|^error$|^e$|^err$',
        }],
        'no-useless-catch': 'off',
      },
    },
  ],
};
