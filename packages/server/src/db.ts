import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'
import type { PoolConfig } from 'mariadb'
import { resolveDatabaseUrl } from './env/database-url.js'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** Parse a mysql:// URL into a mariadb pool config. */
function poolConfigFromUrl(url: string): PoolConfig {
  const parsed = new URL(url.replace(/^mysql:/i, 'http:'))
  const database = parsed.pathname.replace(/^\//, '') || undefined

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    // MySQL 8 caching_sha2_password needs this when not using SSL.
    allowPublicKeyRetrieval: true,
  }
}

function createPrismaClient(): PrismaClient {
  const url = resolveDatabaseUrl()

  // Prisma 7 requires a driver adapter for the runtime connection.
  // Pass PoolConfig (not raw URL) so we can set MySQL 8 auth options.
  const adapter = new PrismaMariaDb(poolConfigFromUrl(url))
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
