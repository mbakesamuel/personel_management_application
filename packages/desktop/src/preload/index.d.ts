import type { ServerConfig } from '@personel-management-app/shared'

export type DesktopApi = {
  getServerConfig: () => Promise<ServerConfig>
  printHtml: (
    html: string,
    options?: { landscape?: boolean },
  ) => Promise<{ ok: boolean }>
  htmlToPdf: (
    html: string,
    options?: { landscape?: boolean },
  ) => Promise<Uint8Array>
  savePdf: (input: {
    defaultName: string
    data: Uint8Array
  }) => Promise<{ cancelled: true } | { ok: true; path: string }>
  saveFile: (input: {
    defaultName: string
    data: Uint8Array
  }) => Promise<{ cancelled: true } | { ok: true; path: string }>
}

declare global {
  interface Window {
    api: DesktopApi
  }
}

export {}
