import { useEffect, useState, type RefObject } from 'react'

const FALLBACK_HEADER_HEIGHT = 40
const FALLBACK_ROW_HEIGHT = 56

function fittedPageSize(viewport: HTMLElement): number | null {
  const height = viewport.clientHeight
  if (height <= 0) return null
  const header = viewport.querySelector('thead')
  const row = viewport.querySelector('tbody tr')
  const headerHeight = header?.getBoundingClientRect().height || FALLBACK_HEADER_HEIGHT
  const rowHeight = row?.getBoundingClientRect().height || FALLBACK_ROW_HEIGHT
  if (rowHeight <= 0) return null
  return Math.max(1, Math.floor((height - headerHeight) / rowHeight))
}

/** Page size that fills the measured table viewport. Starts at 10 until layout is known. */
export function useFitPageSize(ref: RefObject<HTMLDivElement | null>): number {
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    const viewport = ref.current
    if (!viewport) return

    const measure = () => {
      const next = fittedPageSize(viewport)
      if (next == null) return
      setPageSize((current) => (current === next ? current : next))
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(viewport)
    const mutationObserver = new MutationObserver(measure)
    mutationObserver.observe(viewport, { childList: true, subtree: true })
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [ref])

  return pageSize
}
