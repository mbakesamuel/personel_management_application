import {
  type AllowanceEmployeeOption,
  type CommunicationAmount,
  type CommunicationRegistration,
} from '@personel-management-app/shared'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type AllowanceHistoryConsoleProps = {
  onClose: () => void
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

export function AllowanceHistoryConsole({ onClose }: AllowanceHistoryConsoleProps) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AllowanceEmployeeOption[]>([])
  const [selected, setSelected] = useState<AllowanceEmployeeOption | null>(null)
  const [registrations, setRegistrations] = useState<CommunicationRegistration[]>([])
  const [amounts, setAmounts] = useState<CommunicationAmount[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const lines = useMemo(() => {
    if (!selected) return []
    return registrations
      .filter((row) => row.matricule === selected.matricule)
      .sort((a, b) => b.appointmentDate.localeCompare(a.appointmentDate) || b.id - a.id)
  }, [registrations, selected])

  const byId = useMemo(
    () => new Map(registrations.map((row) => [row.id, row])),
    [registrations],
  )

  async function search() {
    setStatus(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      const res = await client.communication.employees.$get({ query: { q: query } })
      if (!res.ok) throw new Error(await readError(res, 'Employee search failed'))
      setHits((await res.json()) as AllowanceEmployeeOption[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Employee search failed')
    } finally {
      setLoading(false)
    }
  }

  async function choose(hit: AllowanceEmployeeOption) {
    setSelected(hit)
    setHits([])
    setQuery(`${hit.name} (${hit.matricule})`)
    setStatus(null)
    setLoaded(false)
    setLoading(true)
    try {
      const client = await createApiClient()
      const [registrationsRes, amountsRes] = await Promise.all([
        client.communication.registrations.$get(),
        client.communication.amounts.$get(),
      ])
      if (!registrationsRes.ok) {
        throw new Error(await readError(registrationsRes, 'Failed to load registrations'))
      }
      if (!amountsRes.ok) throw new Error(await readError(amountsRes, 'Failed to load amounts'))
      setRegistrations((await registrationsRes.json()) as CommunicationRegistration[])
      setAmounts((await amountsRes.json()) as CommunicationAmount[])
      setLoaded(true)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 md:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Allowance history</h1>
          <p className="text-sm text-muted-foreground">
            Search one employee to see every operator line, amount, and transfer.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="size-4" />
          Close
        </Button>
      </div>

      <div className="flex max-w-xl gap-2">
        <Input
          value={query}
          placeholder="Matricule or name"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void search()
          }}
        />
        <Button type="button" variant="outline" onClick={() => void search()} disabled={loading}>
          Find
        </Button>
      </div>

      {status ? <p className="mt-3 text-sm text-destructive">{status}</p> : null}

      {hits.length > 0 ? (
        <ul className="mt-3 max-h-40 max-w-xl overflow-auto rounded-md border">
          {hits.map((hit) => (
            <li key={hit.matricule}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => void choose(hit)}
              >
                <span className="font-medium">{hit.name}</span>
                <span className="ml-2 text-muted-foreground">{hit.matricule}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selected && loaded && lines.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {selected.name} has no communication allowance lines.
        </p>
      ) : null}

      <div className="mt-6 grid gap-4">
        {lines.map((line) => {
          const replacement = line.replacedById == null ? null : byId.get(line.replacedById)
          const history = amounts
            .filter((item) => item.fleetRegistrationId === line.id)
            .sort((a, b) => b.id - a.id)
          return (
            <section key={line.id} className="rounded-md border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    {line.operators.map((operator) => operator.name).join(', ') || 'No operator yet'}
                  </h2>
                </div>
                <span
                  className={
                    line.endDate == null
                      ? 'rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
                      : 'rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                  }
                >
                  {line.endDate == null ? 'Open' : 'Closed'}
                </span>
              </div>
              <p className="mt-2 text-sm">
                Appointment {line.appointmentDate}
                {line.endDate ? ` · Ended ${line.endDate}` : ''}
                {replacement
                  ? ` · Transferred to ${replacement.operators.map((operator) => operator.name).join(', ') || 'a new appointment'}`
                  : ''}
              </p>
              {history.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No amounts on this line.</p>
              ) : (
                <Table className="mt-3">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operator</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Current</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.operatorName}</TableCell>
                        <TableCell>{item.phoneNumber || '—'}</TableCell>
                        <TableCell>{item.accountNo ?? '—'}</TableCell>
                        <TableCell>{item.serviceName}</TableCell>
                        <TableCell>{formatAmount(item.amount)}</TableCell>
                        <TableCell>{item.current ? 'Current' : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
