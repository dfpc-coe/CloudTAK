import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue'
export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    rules: {
        "vue/html-quotes": ["error", "single", { "avoidEscape": false } ],
        "vue/multi-word-component-names": 1,
        "vue/no-multiple-template-root": 0,
        "vue/no-v-model-argument": 0,
        "vue/require-v-for-key": 0
    }
  }
]
