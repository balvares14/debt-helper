/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute origin for the API. Leave unset to use the dev proxy / same origin. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
