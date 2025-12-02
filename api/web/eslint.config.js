import globals from 'globals';
import js from '@eslint/js';
import eslintPluginVue from 'eslint-plugin-vue';
import ts from 'typescript-eslint';

export default ts.config(
    js.configs.recommended,
    ...ts.configs.recommended,
    ...eslintPluginVue.configs['flat/recommended'],
    {
        languageOptions: {
            sourceType: 'module',
            parserOptions: {
                parser: '@typescript-eslint/parser'
            },
            globals: {
                ...globals.browser
            }
        },
        rules: {
            "vue/html-indent": ["error", 4],
            "vue/html-quotes": ["error", "single", { "avoidEscape": false } ],
            "vue/multi-word-component-names": 1,
            "vue/no-multiple-template-root": 0,
            "vue/no-v-model-argument": 0,
            "vue/require-v-for-key": 0
        }
    },
    {
        files: ['src/test/**/*.ts'],
        rules: {
            "@typescript-eslint/no-explicit-any": "off"
        }
    },
    {
        files: ["public/sw.js"],
        languageOptions: {
            globals: {
                self: "readonly",
                clients: "readonly",
                caches: "readonly",
                fetch: "readonly",
                URL: "readonly",
                console: "readonly",
                location: "readonly"
            }
        }
    }
)
