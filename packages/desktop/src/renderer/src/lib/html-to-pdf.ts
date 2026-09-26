export async function htmlToPdfBytes(
  html: string,
  options?: { landscape?: boolean },
): Promise<Uint8Array> {
  if (typeof window.api?.htmlToPdf !== 'function') {
    throw new Error(
      'PDF generation is unavailable. Restart the desktop app and try again.',
    )
  }
  return window.api.htmlToPdf(html, options)
}
