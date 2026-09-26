/** Format an ISO date (YYYY-MM-DD) or parseable date string as dd/mm/yyyy. */
export function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return ''
  const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}
