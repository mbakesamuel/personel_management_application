import { cors } from 'hono/cors'
import type { MiddlewareHandler } from 'hono'

/** Permissive CORS for LAN Electron clients talking to the local API. */
export const corsMiddleware: MiddlewareHandler = cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
})
