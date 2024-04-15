import pluginVue from 'eslint-plugin-vue'
export default [
  // add more generic rulesets here, such as:
  // js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // ...pluginVue.configs['flat/vue2-recommended'], // Use this if you are using Vue.js 2.x.
  {
    "rules": {
        "vue/multi-word-component-names": 1,
        "vue/no-multiple-template-root": 0,
        "vue/no-v-model-argument": 0,
        "vue/require-v-for-key": 0
    }
  }
]
