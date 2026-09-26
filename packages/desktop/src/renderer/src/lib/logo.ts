import logoSrc from '../assets/logo.svg'
import logoSvgRaw from '../assets/logo.svg?raw'

/** Bundled URL for `<img src>`. */
export const LOGO_SRC = logoSrc

/** Raw SVG markup (for data URIs). */
export const LOGO_SVG_RAW = logoSvgRaw

/** Print-safe data URI used in Electron print HTML. */
export const LOGO_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvgRaw)}`
