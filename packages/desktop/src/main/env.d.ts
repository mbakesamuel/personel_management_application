/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  readonly SERVER_TARGET?: string
  readonly SERVER_URL_DEV?: string
  readonly SERVER_URL_PROD?: string
  /** @deprecated Prefer SERVER_URL_DEV / SERVER_URL_PROD with SERVER_TARGET */
  readonly SERVER_URL?: string
  readonly AUTH_TOKEN?: string
}
