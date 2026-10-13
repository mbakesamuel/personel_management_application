import { useState } from 'react'
import { createApiClient } from '../api/client'
import { formatDisplayDate } from '../lib/format-date'
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

type AbsenceReportProps = {
  onClose: () => void
}

type AbsenceRow = {
  source: 'LEAVE' | 'PERMISSION'
  id: number
  matricule: string
  typeName: string
  paid: boolean | null
  applicationDate: string
  startDate: string | null
  endDate: string | null
  days: number | null
  status: string
}

function day(value: string | null | undefined) {
  return formatDisplayDate(value) || '—'
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function AbsenceReport({ onClose }: AbsenceReportProps) {
  const [matricule, setMatricule] = useState('')
  const [rows, setRows] = useState<AbsenceRow[]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const trimmed = matricule.trim()
      const res = await client.leave['absence-report'].$get({
        query: trimmed ? { matricule: trimmed } : {},
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to load the report'))
      setRows((await res.json()) as AbsenceRow[])
      setLoaded(true)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Absence report</h1>
          <p className="text-sm text-muted-foreground">
            Leave and permission requests. Paid event permissions do not reduce
            the annual leave balance.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void load()
        }}
      >
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Matricule</span>
          <Input
            value={matricule}
            onChange={(event) => setMatricule(event.target.value)}
            className="w-48"
            placeholder="All in scope"
          />
        </label>
        <Button type="submit" disabled={loading}>
          Load
        </Button>
      </form>
      {status ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}
      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matricule</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                  {loaded ? 'No absences in this scope.' : 'Load the report.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={`${row.source}-${row.id}`}>
                  <TableCell>{row.matricule}</TableCell>
                  <TableCell>{row.source === 'LEAVE' ? 'Leave' : 'Permission'}</TableCell>
                  <TableCell>{row.typeName}</TableCell>
                  <TableCell>{row.paid == null ? '—' : row.paid ? 'Paid' : 'Unpaid'}</TableCell>
                  <TableCell>{day(row.startDate)}</TableCell>
                  <TableCell>{day(row.endDate)}</TableCell>
                  <TableCell>{row.days ?? '—'}</TableCell>
                  <TableCell>{row.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
