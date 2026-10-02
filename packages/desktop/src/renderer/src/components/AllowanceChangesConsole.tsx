import {
  type CommunicationAmount,
  type CommunicationBatchReport,
  type CommunicationOperator,
  type CommunicationRegistration,
  type CommunicationServiceOption,
} from '@personel-management-app/shared'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { LetterPdfOverlay } from './LetterPdfOverlay'
import { batchReportDocument, isOrangeOperator } from './OrangeOperatorMemo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type AllowanceChangesConsoleProps = {
  onClose: () => void
}

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function AllowanceChangesConsole({ onClose }: AllowanceChangesConsoleProps) {
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [registrations, setRegistrations] = useState<CommunicationRegistration[]>([])
  const [amounts, setAmounts] = useState<CommunicationAmount[]>([])
  const [services, setServices] = useState<CommunicationServiceOption[]>([])
  const [operatorId, setOperatorId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [modifications, setModifications] = useState<Set<number>>(new Set())
  const [removals, setRemovals] = useState<Set<number>>(new Set())
  const [inclusions, setInclusions] = useState<Set<number>>(new Set())
  const [amountDrafts, setAmountDrafts] = useState<Record<number, Record<number, string>>>({})
  const [lineTab, setLineTab] = useState<'inclusion' | 'modification' | 'removal'>('inclusion')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [letter, setLetter] = useState<{ html: string; title: string } | null>(null)

  const load = useCallback(async () => {
    const client = await createApiClient()
    const [operatorsRes, registrationsRes, amountsRes, servicesRes] = await Promise.all([
      client.communication.operators.$get(),
      client.communication.registrations.$get(),
      client.communication.amounts.$get(),
      client.communication.services.$get(),
    ])
    if (!operatorsRes.ok) throw new Error(await readError(operatorsRes, 'Failed to load operators'))
    if (!registrationsRes.ok) {
      throw new Error(await readError(registrationsRes, 'Failed to load registrations'))
    }
    if (!amountsRes.ok) throw new Error(await readError(amountsRes, 'Failed to load amounts'))
    if (!servicesRes.ok) throw new Error(await readError(servicesRes, 'Failed to load services'))
    setOperators((await operatorsRes.json()) as CommunicationOperator[])
    setRegistrations((await registrationsRes.json()) as CommunicationRegistration[])
    setAmounts((await amountsRes.json()) as CommunicationAmount[])
    setServices((await servicesRes.json()) as CommunicationServiceOption[])
  }, [])

  useEffect(() => {
    void load().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load')
    })
  }, [load])

  const openLines = useMemo(
    () =>
      registrations.filter(
        (row) => String(row.operatorId) === operatorId && row.endDate == null,
      ),
    [operatorId, registrations],
  )
  const inclusionLines = useMemo(
    () => openLines.filter((row) => !row.includedInBatch),
    [openLines],
  )
  const visibleLines = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return openLines
    return openLines.filter((row) =>
      [row.employeeName, row.matricule, row.phoneNumber]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [openLines, search])
  const visibleInclusionLines = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return inclusionLines
    return inclusionLines.filter((row) =>
      [row.employeeName, row.matricule, row.phoneNumber]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [inclusionLines, search])

  function currentAmount(registrationId: number, serviceId: number): number | null {
    const match = amounts.find(
      (item) =>
        item.fleetRegistrationId === registrationId &&
        item.serviceId === serviceId &&
        item.current,
    )
    return match ? match.amount : null
  }

  function chooseOperator(value: string) {
    setOperatorId(value)
    setModifications(new Set())
    setRemovals(new Set())
    setInclusions(new Set())
    setAmountDrafts({})
    setSearch('')
    setStatus(null)
  }

  function toggleModification(id: number, checked: boolean) {
    setModifications((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    if (checked) {
      setRemovals((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setInclusions((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function toggleRemoval(id: number, checked: boolean) {
    setRemovals((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    if (checked) {
      setModifications((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setInclusions((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function toggleInclusion(id: number, checked: boolean) {
    setInclusions((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    if (checked) {
      setModifications((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setRemovals((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function setDraft(registrationId: number, serviceId: number, value: string) {
    setAmountDrafts((prev) => ({
      ...prev,
      [registrationId]: { ...prev[registrationId], [serviceId]: value },
    }))
  }

  async function applyBatch() {
    setStatus(null)
    if (!operatorId) {
      setStatus('Choose an operator')
      return
    }
    if (modifications.size === 0 && removals.size === 0 && inclusions.size === 0) {
      setStatus('Check at least one line')
      return
    }
    setLoading(true)
    try {
      const lines = [
      ...[...modifications].map((id) => {
        const row = openLines.find((item) => item.id === id)
        const amounts = services.flatMap((service) => {
          const raw = amountDrafts[id]?.[service.id]?.trim() ?? ''
          if (!raw) return []
          const amount = Number(raw)
          if (!Number.isFinite(amount) || amount < 0) {
            throw new Error(`Enter a valid amount for ${row?.employeeName ?? 'the line'}`)
          }
          return [{ serviceId: service.id, amount }]
        })
        if (amounts.length === 0) {
          throw new Error(`Enter at least one amount for ${row?.employeeName ?? 'the line'}`)
        }
        return {
          fleetRegistrationId: id,
          action: 'MODIFICATION' as const,
          amounts,
        }
      }),
      ...[...removals].map((id) => ({
        fleetRegistrationId: id,
        action: 'REMOVAL' as const,
        amounts: [],
      })),
      ...[...inclusions].map((id) => ({
        fleetRegistrationId: id,
        action: 'CREATION' as const,
        amounts: [],
      })),
      ]
      const client = await createApiClient()
      const res = await client.communication.batches.$post({
        json: {
          operatorId: Number(operatorId),
          effectiveDate,
          endDate,
          lines,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Batch failed'))
      setLetter(batchReportDocument((await res.json()) as CommunicationBatchReport))
      setModifications(new Set())
      setRemovals(new Set())
      setInclusions(new Set())
      setAmountDrafts({})
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Batch failed')
    } finally {
      setLoading(false)
    }
  }

  const marked = modifications.size + removals.size + inclusions.size
  const orangeOperator = isOrangeOperator(
    operators.find((row) => String(row.id) === operatorId)?.name ?? '',
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 md:p-4">
      <div className="no-print mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Allowance changes</h1>
          <p className="text-sm text-muted-foreground">
            Mark open lines for one operator, then apply the batch.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </div>

      {status ? (
        <p className="no-print mb-3 text-sm text-destructive">{status}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          Operator
          <Select value={operatorId || undefined} onValueChange={chooseOperator}>
            <SelectTrigger>
              <SelectValue placeholder="Choose operator" />
            </SelectTrigger>
            <SelectContent>
              {operators
                .filter((row) => row.isActive)
                .map((row) => (
                  <SelectItem key={row.id} value={String(row.id)}>
                    {row.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-sm">
          Amount effective date
          <Input
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          Removal end date
          <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
      </div>

      <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{marked} line{marked === 1 ? '' : 's'} marked</p>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, matricule, or phone…"
            className="w-64"
            disabled={!operatorId}
          />
          <Button type="button" onClick={() => void applyBatch()} disabled={loading || !operatorId}>
            {loading ? 'Saving…' : 'Apply batch'}
          </Button>
        </div>
      </div>

      <Tabs
        value={lineTab}
        onValueChange={(value) =>
          setLineTab(value as 'inclusion' | 'modification' | 'removal')
        }
        className="no-print mt-4"
      >
        <TabsList>
          <TabsTrigger value="inclusion">Inclusion ({inclusions.size})</TabsTrigger>
          <TabsTrigger value="modification">Modification ({modifications.size})</TabsTrigger>
          <TabsTrigger value="removal">Removal ({removals.size})</TabsTrigger>
        </TabsList>
      </Tabs>

      {lineTab === 'modification' ? (
        <section className="no-print mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Employee</TableHead>
                <TableHead>Phone</TableHead>
                {services.map((service) => (
                  <TableHead key={service.id}>
                    {service.name}
                    <span className="block text-xs font-normal text-muted-foreground">
                      Current / new
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLines.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={modifications.has(row.id)}
                      onChange={(event) => toggleModification(row.id, event.target.checked)}
                      aria-label={`Modify ${row.employeeName}`}
                    />
                  </TableCell>
                  <TableCell>
                    {row.employeeName}
                    <span className="block text-xs text-muted-foreground">{row.matricule}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  {services.map((service) => {
                    const current = currentAmount(row.id, service.id)
                    return (
                      <TableCell key={service.id}>
                        <p className="mb-1 text-xs text-muted-foreground">
                          {current == null ? '—' : formatAmount(current)}
                        </p>
                        <Input
                          inputMode="decimal"
                          disabled={!modifications.has(row.id)}
                          value={amountDrafts[row.id]?.[service.id] ?? ''}
                          onChange={(event) => setDraft(row.id, service.id, event.target.value)}
                          className="h-8 w-24"
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {operatorId && openLines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No open lines for this operator.</p>
          ) : null}
          {operatorId && openLines.length > 0 && visibleLines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No lines match the search.</p>
          ) : null}
        </section>
      ) : lineTab === 'removal' ? (
        <section className="no-print mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Employee</TableHead>
                <TableHead>Phone</TableHead>
                {services.map((service) => (
                  <TableHead key={service.id}>{service.name}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleLines.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={removals.has(row.id)}
                      onChange={(event) => toggleRemoval(row.id, event.target.checked)}
                      aria-label={`Remove ${row.employeeName}`}
                    />
                  </TableCell>
                  <TableCell>
                    {row.employeeName}
                    <span className="block text-xs text-muted-foreground">{row.matricule}</span>
                  </TableCell>
                  <TableCell>{row.phoneNumber}</TableCell>
                  {services.map((service) => {
                    const current = currentAmount(row.id, service.id)
                    return (
                      <TableCell key={service.id}>
                        {current == null ? '—' : formatAmount(current)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {operatorId && openLines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No open lines for this operator.</p>
          ) : null}
          {operatorId && openLines.length > 0 && visibleLines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No lines match the search.</p>
          ) : null}
        </section>
      ) : (
        <section className="no-print mt-3">
          {operatorId && !orangeOperator ? (
            <p className="text-sm text-muted-foreground">
              The creation letter is for Orange only.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Employee</TableHead>
                    <TableHead>Phone</TableHead>
                    {services.map((service) => (
                      <TableHead key={service.id}>{service.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleInclusionLines.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={inclusions.has(row.id)}
                          onChange={(event) => toggleInclusion(row.id, event.target.checked)}
                          aria-label={`Include ${row.employeeName}`}
                        />
                      </TableCell>
                      <TableCell>
                        {row.employeeName}
                        <span className="block text-xs text-muted-foreground">{row.matricule}</span>
                      </TableCell>
                      <TableCell>{row.phoneNumber}</TableCell>
                      {services.map((service) => {
                        const current = currentAmount(row.id, service.id)
                        return (
                          <TableCell key={service.id}>
                            {current == null ? '—' : formatAmount(current)}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {operatorId && openLines.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No open lines for this operator.</p>
              ) : null}
              {operatorId && openLines.length > 0 && inclusionLines.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  They are already on an inclusion letter.
                </p>
              ) : null}
              {operatorId && inclusionLines.length > 0 && visibleInclusionLines.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No lines match the search.</p>
              ) : null}
            </>
          )}
        </section>
      )}

    </div>
    {letter ? (
      <LetterPdfOverlay
        html={letter.html}
        title={letter.title}
        onClose={() => setLetter(null)}
      />
    ) : null}
    </div>
  )
}
