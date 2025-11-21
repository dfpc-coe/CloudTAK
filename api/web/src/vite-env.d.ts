/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HASH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
