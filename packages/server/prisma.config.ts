import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

function databaseUrl() {
  return env('DATABASE_URL').replace(/^['"]+|['"]+$/g, '')
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl(),
  },
})
