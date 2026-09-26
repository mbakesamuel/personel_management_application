import { hc } from 'hono/client'

import type { AppType } from '@perf-appraisal-app/server'



let currentUserId: number | null = null



export function setCurrentUserId(id: number | null) {

  currentUserId = id

}



export async function createApiClient() {

  const config = await window.api.getServerConfig()



  if (!config.serverUrl) {

    throw new Error(

      'SERVER_URL is not set. Add it to packages/desktop/.env (see .env.example).',

    )

  }



  const headers: Record<string, string> = {}

  if (config.authToken) {

    headers.Authorization = `Bearer ${config.authToken}`

  }

  if (currentUserId != null) {

    headers['x-user-id'] = String(currentUserId)

  }



  return hc<AppType>(config.serverUrl.replace(/\/$/, ''), {

    headers,

  })

}


