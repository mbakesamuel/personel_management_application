import type { ServerConfig } from '@perf-appraisal-app/shared'

/** Reads API connection settings from packages/desktop/.env (injected by electron-vite). */
export function getServerConfig(): ServerConfig {
  return {
    serverUrl: String(import.meta.env.SERVER_URL ?? '').trim(),
    authToken: String(import.meta.env.AUTH_TOKEN ?? '').trim(),
  }
}
