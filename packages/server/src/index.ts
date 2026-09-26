import 'dotenv/config'
import { serve } from '@hono/node-server'
import { app } from './app.js'

export type { AppType } from './app.js'
export { app }

const port = Number(process.env.PORT ?? 3000)

serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0',
  },
  (info) => {
    console.log(`Server listening on http://0.0.0.0:${info.port}`)
  },
)
