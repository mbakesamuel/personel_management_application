const TARGETS = {
  dev: 'DATABASE_URL_DEV',
  prod: 'DATABASE_URL_PROD',
} as const

type DbTarget = keyof typeof TARGETS

function stripQuotes(value: string): string {
  return value.replace(/^['"]+|['"]+$/g, '')
}

function readEnv(name: string): string | undefined {
  const raw = process.env[name]
  if (raw == null || raw.trim() === '') return undefined
  return stripQuotes(raw.trim())
}

/**
 * Resolve the active database URL from DB_TARGET (dev | prod).
 * Falls back to legacy DATABASE_URL when the named URL is unset.
 */
export function resolveDatabaseUrl(): string {
  const rawTarget = (process.env.DB_TARGET ?? 'dev').trim().toLowerCase()

  if (rawTarget !== 'dev' && rawTarget !== 'prod') {
    throw new Error(
      `Invalid DB_TARGET="${process.env.DB_TARGET}". Use "dev" or "prod".`,
    )
  }

  const target = rawTarget as DbTarget
  const envName = TARGETS[target]
  const namedUrl = readEnv(envName)
  if (namedUrl) return namedUrl

  const legacyUrl = readEnv('DATABASE_URL')
  if (legacyUrl) return legacyUrl

  throw new Error(
    `${envName} is not set for DB_TARGET=${target}. ` +
      'Set it in .env (or provide legacy DATABASE_URL). See .env.example.',
  )
}
