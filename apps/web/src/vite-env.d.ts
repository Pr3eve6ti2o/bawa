/// <reference types="vite/client" />

type ImportMetaEnv = Record<string, string | boolean | undefined>

interface ImportMeta {
  readonly env: ImportMetaEnv
}
