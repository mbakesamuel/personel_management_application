import { useCallback, useEffect, useMemo, useState } from 'react'

export type SortDir = 'asc' | 'desc'

export type UseCatalogTableOptions<T, Tab extends string = string> = {
  rows: T[]
  getId: (row: T) => string | number
  pageSize?: number
  /** Return true when row matches the active filter tab. Tab `"all"` always matches. */
  matchesTab?: (row: T, tab: Tab) => boolean
  /** Return true when row matches the search query (already lowercased). */
  matchesSearch: (row: T, query: string) => boolean
  /** Extract sortable string/number for a column key. */
  getSortValue: (row: T, sortKey: string) => string | number | null | undefined
  defaultSortKey: string
  defaultSortDir?: SortDir
  defaultTab?: Tab
}

export function useCatalogTable<T, Tab extends string = string>(
  options: UseCatalogTableOptions<T, Tab>,
) {
  const {
    rows,
    getId,
    pageSize = 10,
    matchesTab,
    matchesSearch,
    getSortValue,
    defaultSortKey,
    defaultSortDir = 'asc',
    defaultTab = 'all' as Tab,
  } = options

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab)
  const [sortKey, setSortKey] = useState(defaultSortKey)
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    () => new Set(),
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const tabOk = !matchesTab || activeTab === 'all' || matchesTab(row, activeTab)
      const searchOk = !query || matchesSearch(row, query)
      return tabOk && searchOk
    })
  }, [rows, search, activeTab, matchesTab, matchesSearch])

  const sorted = useMemo(() => {
    const next = [...filtered]
    next.sort((left, right) => {
      const leftValue = String(getSortValue(left, sortKey) ?? '')
      const rightValue = String(getSortValue(right, sortKey) ?? '')
      const result = leftValue.localeCompare(rightValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
      return sortDir === 'asc' ? result : -result
    })
    return next
  }, [filtered, sortKey, sortDir, getSortValue])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginated = useMemo(
    () =>
      sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  )

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pageStart =
    sorted.length === 0
      ? 0
      : Math.min((currentPage - 1) * pageSize + 1, sorted.length)
  const pageEnd = Math.min(currentPage * pageSize, sorted.length)

  const allPageSelected =
    paginated.length > 0 &&
    paginated.every((row) => selectedIds.has(getId(row)))

  const toggleSort = useCallback((key: string) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
        return current
      }
      setSortDir('asc')
      return key
    })
    setPage(1)
  }, [])

  const setSearchAndResetPage = useCallback((value: string) => {
    setSearch(value)
    setPage(1)
  }, [])

  const setActiveTabAndResetPage = useCallback((tab: Tab) => {
    setActiveTab(tab)
    setPage(1)
  }, [])

  const toggleSelect = useCallback(
    (id: string | number) => {
      setSelectedIds((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    [],
  )

  const toggleSelectAllPage = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allPageSelected) {
        paginated.forEach((row) => next.delete(getId(row)))
      } else {
        paginated.forEach((row) => next.add(getId(row)))
      }
      return next
    })
  }, [allPageSelected, paginated, getId])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const resetListState = useCallback(() => {
    setSearch('')
    setActiveTab(defaultTab)
    setSortKey(defaultSortKey)
    setSortDir(defaultSortDir)
    setPage(1)
    setSelectedIds(new Set())
  }, [defaultTab, defaultSortKey, defaultSortDir])

  return {
    search,
    setSearch: setSearchAndResetPage,
    activeTab,
    setActiveTab: setActiveTabAndResetPage,
    sortKey,
    sortDir,
    toggleSort,
    page: currentPage,
    setPage,
    totalPages,
    pageStart,
    pageEnd,
    filteredCount: filtered.length,
    sorted,
    paginated,
    selectedIds,
    toggleSelect,
    toggleSelectAllPage,
    allPageSelected,
    clearSelection,
    resetListState,
  }
}
