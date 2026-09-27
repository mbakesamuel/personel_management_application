import type { ServerConfig } from '@personel-management-app/shared'

function readEnv(value: unknown): string {
  return String(value ?? '').trim()
}

/**
 * Resolve the active API base URL from SERVER_TARGET (dev | prod).
 * Falls back to legacy SERVER_URL when the named URL is unset.
 */
function resolveServerUrl(): string {
  const rawTarget = readEnv(import.meta.env.SERVER_TARGET).toLowerCase() || 'dev'

  if (rawTarget !== 'dev' && rawTarget !== 'prod') {
    throw new Error(
      `Invalid SERVER_TARGET="${import.meta.env.SERVER_TARGET}". Use "dev" or "prod".`,
    )
  }

  const named =
    rawTarget === 'prod'
      ? readEnv(import.meta.env.SERVER_URL_PROD)
      : readEnv(import.meta.env.SERVER_URL_DEV)

  if (named) return named

  const legacy = readEnv(import.meta.env.SERVER_URL)
  if (legacy) return legacy

  throw new Error(
    `SERVER_URL_${rawTarget.toUpperCase()} is not set for SERVER_TARGET=${rawTarget}. ` +
      'Set it in packages/desktop/.env (see .env.example).',
  )
}

/** Reads API connection settings from packages/desktop/.env (injected by electron-vite). */
export function getServerConfig(): ServerConfig {
  return {
    serverUrl: resolveServerUrl(),
    authToken: readEnv(import.meta.env.AUTH_TOKEN),
  }
}
