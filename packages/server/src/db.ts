import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL?.replace(/^['"]+|['"]+$/g, '')
  if (!url) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.')
  }

  // Prisma 7 requires a driver adapter for the runtime connection.
  // PrismaMariaDb accepts the connection string and rewrites mysql:// to mariadb://.
  const adapter = new PrismaMariaDb(url)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
