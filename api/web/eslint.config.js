import js from '@eslint/js'
import eslintPluginVue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'

export default ts.config(
    js.configs.recommended,
    ...ts.configs.recommended,
    ...eslintPluginVue.configs['flat/recommended'],
    {
        languageOptions: {
            parserOptions: {
                parser: '@typescript-eslint/parser'
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
    }
)
