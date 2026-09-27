import js from '@eslint/js';
import configPrettier from 'eslint-config-prettier';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
    js.configs.recommended,
    configPrettier,

    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            prettier,
        },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'always'],
            'prettier/prettier': 'error',
        },
    },

    {
        files: ['demo/**/*.js'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                widgetry: 'readonly',
                demoData: 'readonly',
            },
        },
    },

    {
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                widgetry: 'readonly',
            },
        },
    },

    {
        ignores: ['node_modules/', 'dist/', 'test-results/', 'playwright-report/'],
    },
];
