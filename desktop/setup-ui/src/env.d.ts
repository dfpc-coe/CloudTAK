/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@tak-ps/vue-tabler' {
  import { Plugin } from 'vue'
  const plugin: Plugin
  export default plugin
}

declare const require: any;
