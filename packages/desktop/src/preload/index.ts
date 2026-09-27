import { contextBridge, ipcRenderer } from 'electron'
import type { ServerConfig } from '@personel-management-app/shared'

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = Buffer.from(base64, 'base64')
  return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength)
}

const api = {
  getServerConfig: (): Promise<ServerConfig> =>
    ipcRenderer.invoke('server-config:get'),
  printHtml: (
    html: string,
    options?: { landscape?: boolean },
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('report:print-html', html, options),
  htmlToPdf: async (
    html: string,
    options?: { landscape?: boolean },
  ): Promise<Uint8Array> => {
    const base64 = (await ipcRenderer.invoke(
      'report:html-to-pdf',
      html,
      options,
    )) as string
    if (typeof base64 !== 'string' || base64.length === 0) {
      throw new Error('PDF generation returned no data')
    }
    return base64ToUint8Array(base64)
  },
  savePdf: (input: {
    defaultName: string
    data: Uint8Array
  }): Promise<{ cancelled: true } | { ok: true; path: string }> =>
    ipcRenderer.invoke('report:save-pdf', {
      defaultName: input.defaultName,
      data: Buffer.from(input.data),
    }),
  saveFile: (input: {
    defaultName: string
    data: Uint8Array
  }): Promise<{ cancelled: true } | { ok: true; path: string }> =>
    ipcRenderer.invoke('file:save', {
      defaultName: input.defaultName,
      data: Buffer.from(input.data),
    }),
}

contextBridge.exposeInMainWorld('api', api)

export type DesktopApi = typeof api
