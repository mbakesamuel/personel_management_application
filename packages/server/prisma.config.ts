import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { resolveDatabaseUrl } from './src/env/database-url.ts'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
})
