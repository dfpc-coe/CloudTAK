import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import tseslint from 'typescript-eslint';

// The api server is partitioned into three top-level layers by whether code
// touches in-memory server state. The rule below enforces the boundary

const boundary = (groups, message) => ({
    '@typescript-eslint/no-restricted-imports': ['error', {
        patterns: [{ group: groups, message, allowTypeImports: true }],
    }],
});

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    stylistic.configs.customize({
        indent: 4,
        quotes: 'single',
        semi: true,
    }),
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }]
        }
    },
    {
        files: ['common/**/*.ts'],
        rules: boundary(
            ['**/stateful/**', '**/stateless/**'],
            'common/ is the shared base and must not import stateful/ or stateless/ at runtime. Invert via the wire() hook (see stateful/wire.ts) or use a type-only import.',
        ),
    },
    {
        files: ['stateless/**/*.ts'],
        rules: boundary(
            ['**/stateful/**'],
            'stateless request-handling code must not import stateful/ runtime state. Go through config.hub (the HubClient interface) or use a type-only import.',
        ),
    },
    {
        files: ['stateful/**/*.ts'],
        rules: boundary(
            ['**/stateless/**'],
            'stateful/ must not import stateless/. Use a type-only import if you only need a type.',
        ),
    },
);
