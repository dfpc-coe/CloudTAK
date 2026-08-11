import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: [
            'node_modules/',
            'playwright-report/',
            'test-results/',
            '.auth/'
        ]
    },
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        rules: {
            'no-console': 'off',
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }]
        }
    }
);
