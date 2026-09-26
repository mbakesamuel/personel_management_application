import type {
  AllowanceKeywordLink,
  AllowanceOption,
  AllowanceTypeOption,
  PositionKeyword,
} from '@perf-appraisal-app/shared'
import { Grid3x3, Link2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import {
  CatalogFilterTabs,
  CatalogScreen,
  type CatalogStat,
} from './catalog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AllowanceMatrixConsoleProps = {
  onClose: () => void
}

export function AllowanceMatrixConsole({
  onClose,
}: AllowanceMatrixConsoleProps) {
  const [keywords, setKeywords] = useState<PositionKeyword[]>([])
  const [allowances, setAllowances] = useState<AllowanceOption[]>([])
  const [types, setTypes] = useState<AllowanceTypeOption[]>([])
  const [links, setLinks] = useState<AllowanceKeywordLink[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [pendingCell, setPendingCell] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const [kwRes, allRes, typesRes, linksRes] = await Promise.all([
        client['position-keywords'].$get(),
        client.allowances.$get(),
        client.allowances.types.$get(),
        client['allowance-matrix'].$get({ query: {} }),
      ])
      if (!kwRes.ok || !allRes.ok || !typesRes.ok || !linksRes.ok) {
        throw new Error('Failed to load allowance matrix data')
      }
      const allKeywords = (await kwRes.json()) as PositionKeyword[]
      const allAllowances = (await allRes.json()) as AllowanceOption[]
      setKeywords(allKeywords.filter((row) => row.active))
      setAllowances(
        allAllowances.filter((row) => row.workflowStatus === 'VALIDATED'),
      )
      setTypes((await typesRes.json()) as AllowanceTypeOption[])
      setLinks((await linksRes.json()) as AllowanceKeywordLink[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const linkByPair = useMemo(() => {
    const map = new Map<string, AllowanceKeywordLink>()
    for (const link of links) {
      if (!link.active) continue
      map.set(`${link.keywordId}:${link.allowanceId}`, link)
    }
    return map
  }, [links])

  const typeFilterTabs = useMemo(
    () => [
      { value: 'all', label: 'All types' },
      ...types
        .filter((t) => t.workflowStatus === 'VALIDATED')
        .slice()
        .sort((a, b) => a.allowanceTypeName.localeCompare(b.allowanceTypeName))
        .map((t) => ({ value: t.id, label: t.allowanceTypeName })),
      { value: '__none__', label: 'No type' },
    ],
    [types],
  )

  const visibleAllowances = useMemo(() => {
    const filtered =
      typeFilter === 'all'
        ? allowances
        : typeFilter === '__none__'
          ? allowances.filter((a) => !a.allowanceTypeId)
          : allowances.filter((a) => a.allowanceTypeId === typeFilter)
    return filtered
      .slice()
      .sort((a, b) => a.allowanceName.localeCompare(b.allowanceName))
  }, [allowances, typeFilter])

  const sortedKeywords = useMemo(
    () =>
      keywords.slice().sort((a, b) => a.keyword.localeCompare(b.keyword)),
    [keywords],
  )

  const stats: CatalogStat[] = useMemo(
    () => [
      {
        label: 'Keywords',
        value: keywords.length,
        icon: Grid3x3,
        tone: 'blue',
      },
      {
        label: 'Allowances',
        value: allowances.length,
        icon: Grid3x3,
        tone: 'teal',
      },
      {
        label: 'Active links',
        value: links.filter((l) => l.active).length,
        icon: Link2,
        tone: 'emerald',
      },
    ],
    [keywords, allowances, links],
  )

  async function toggleCell(
    keywordId: number,
    allowanceId: string,
    checked: boolean,
  ) {
    const cellKey = `${keywordId}:${allowanceId}`
    setPendingCell(cellKey)
    setStatus(null)
    try {
      const client = await createApiClient()
      if (checked) {
        const res = await client['allowance-matrix'].$post({
          json: { allowanceId, keywordId, active: true },
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(body?.error ?? 'Failed to create link')
        }
        const created = (await res.json()) as AllowanceKeywordLink
        setLinks((prev) => {
          const without = prev.filter(
            (l) =>
              !(l.keywordId === keywordId && l.allowanceId === allowanceId),
          )
          return [...without, created]
        })
      } else {
        const existing = linkByPair.get(cellKey)
        if (!existing) return
        const res = await client['allowance-matrix'][':id'].$delete({
          param: { id: String(existing.id) },
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string
          } | null
          throw new Error(body?.error ?? 'Failed to remove link')
        }
        setLinks((prev) => prev.filter((l) => l.id !== existing.id))
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingCell(null)
    }
  }

  return (
    <CatalogScreen
      brandIcon={Grid3x3}
      title="Allowance matrix"
      subtitle="Link position keywords to the allowances they qualify for"
      headerActions={
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      }
      error={status}
      stats={stats}
      cardTitle="Eligibility grid"
      cardSubtitle={
        loading
          ? 'Loading…'
          : `${sortedKeywords.length} keywords × ${visibleAllowances.length} allowances`
      }
      filterTabs={
        <CatalogFilterTabs
          tabs={typeFilterTabs}
          value={typeFilter}
          onChange={setTypeFilter}
        />
      }
      search=""
      onSearchChange={() => {}}
      searchPlaceholder=" "
      toolbarExtra={
        <p className="text-xs text-muted-foreground">
          Check a cell to link; uncheck to remove. Only validated allowances and
          active keywords are shown.
        </p>
      }
      table={
        sortedKeywords.length === 0 || visibleAllowances.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {loading
              ? 'Loading…'
              : sortedKeywords.length === 0
                ? 'Add active position keywords first.'
                : 'No validated allowances match this filter.'}
          </p>
        ) : (
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 border-b border-r bg-muted px-3 py-2 text-left font-medium">
                  Keyword
                </th>
                {visibleAllowances.map((allowance) => (
                  <th
                    key={allowance.id}
                    className="sticky top-0 z-20 max-w-28 border-b bg-muted px-2 py-2 text-center font-medium"
                    title={allowance.allowanceName}
                  >
                    <span className="line-clamp-2 block text-xs leading-tight">
                      {allowance.allowanceName}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedKeywords.map((keyword) => (
                <tr key={keyword.id} className="hover:bg-muted/30">
                  <td className="sticky left-0 z-10 border-b border-r bg-background px-3 py-2 font-medium whitespace-nowrap">
                    {keyword.keyword}
                  </td>
                  {visibleAllowances.map((allowance) => {
                    const cellKey = `${keyword.id}:${allowance.id}`
                    const linked = linkByPair.has(cellKey)
                    const busy = pendingCell === cellKey || loading
                    return (
                      <td
                        key={allowance.id}
                        className="border-b px-2 py-2 text-center"
                      >
                        <input
                          type="checkbox"
                          className={cn(
                            'size-4 accent-primary',
                            busy && 'opacity-50',
                          )}
                          checked={linked}
                          disabled={busy}
                          aria-label={`${keyword.keyword} — ${allowance.allowanceName}`}
                          onChange={(e) =>
                            void toggleCell(
                              keyword.id,
                              allowance.id,
                              e.target.checked,
                            )
                          }
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    />
  )
}
