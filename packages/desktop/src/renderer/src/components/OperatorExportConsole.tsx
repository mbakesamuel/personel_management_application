import type {
  CommunicationMemoDraftRow,
  CommunicationOperator,
} from '@personel-management-app/shared'
import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import {
  buildOperatorFleetExcel,
  operatorFleetExcelName,
  operatorFleetSheets,
  type OperatorFleetSheets,
} from '../lib/export-operator-fleet-excel'
import { Button } from '@/components/ui/button'
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

type OperatorExportConsoleProps = {
  onClose: () => void
}

function formatAmount(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {empty ? (
        <p className="text-sm text-muted-foreground">None waiting.</p>
      ) : (
        children
      )}
    </section>
  )
}

export function OperatorExportConsole({ onClose }: OperatorExportConsoleProps) {
  const [operators, setOperators] = useState<CommunicationOperator[]>([])
  const [rows, setRows] = useState<CommunicationMemoDraftRow[]>([])
  const [operatorId, setOperatorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const operator = operators.find((row) => String(row.id) === operatorId) ?? null
  const sheets: OperatorFleetSheets = useMemo(
    () => (operator ? operatorFleetSheets(operator.name, rows) : { additions: [], modifications: [], removals: [] }),
    [operator, rows],
  )
  const total = sheets.additions.length + sheets.modifications.length + sheets.removals.length

  const loadOperators = useCallback(async () => {
    const client = await createApiClient()
    const res = await client.communication.operators.$get()
    if (!res.ok) throw new Error(await readError(res, 'Failed to load operators'))
    setOperators((await res.json()) as CommunicationOperator[])
  }, [])

  const loadDraft = useCallback(async (nextOperatorId: string) => {
    if (!nextOperatorId) {
      setRows([])
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.communication['memo-draft'].$get({
        query: { operatorId: nextOperatorId },
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to load changes'))
      setRows((await res.json()) as CommunicationMemoDraftRow[])
    } catch (err) {
      setRows([])
      setStatus(err instanceof Error ? err.message : 'Failed to load changes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOperators().catch((err: unknown) => {
      setStatus(err instanceof Error ? err.message : 'Failed to load operators')
    })
  }, [loadOperators])

  useEffect(() => {
    void loadDraft(operatorId)
  }, [loadDraft, operatorId])

  async function exportExcel() {
    if (!operator) return
    setExporting(true)
    setStatus(null)
    try {
      if (typeof window.api?.saveFile !== 'function') {
        throw new Error('Save file is not available in this environment.')
      }
      const result = await window.api.saveFile({
        defaultName: operatorFleetExcelName(operator.name),
        data: buildOperatorFleetExcel(sheets),
      })
      if ('ok' in result && result.ok) {
        const name = result.path.replace(/^.*[/\\]/, '')
        setStatus(`Exported ${total} record(s) to ${name}.`)
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 md:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Operator exports</h1>
          <p className="text-sm text-muted-foreground">
            Pending additions, modifications, and removals for one operator.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void exportExcel()}
            disabled={exporting || loading || !operator}
          >
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <Select value={operatorId} onValueChange={setOperatorId}>
          <SelectTrigger className="w-full max-w-xs">
            <SelectValue placeholder="Select an operator" />
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
      </div>

      {status ? <p className="mb-3 text-sm text-muted-foreground">{status}</p> : null}

      {!operator ? (
        <p className="text-sm text-muted-foreground">Select an operator to preview the export.</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Section title="Addition" empty={sheets.additions.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CLIENT NAME</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead>User Name</TableHead>
                  <TableHead>Telephone</TableHead>
                  <TableHead>IMSI</TableHead>
                  <TableHead>PACKAGE</TableHead>
                  <TableHead>DATA</TableHead>
                  <TableHead>CLI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.additions.map((row, index) => (
                  <TableRow key={`${row.userName}-${row.telephone}-${index}`}>
                    <TableCell>{row.clientName}</TableCell>
                    <TableCell>{row.accountNumber || '—'}</TableCell>
                    <TableCell>{row.userName}</TableCell>
                    <TableCell>{row.telephone}</TableCell>
                    <TableCell>{row.imsi || '—'}</TableCell>
                    <TableCell>{row.packageName || '—'}</TableCell>
                    <TableCell>{formatAmount(row.data)}</TableCell>
                    <TableCell>{formatAmount(row.cli)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title="Modification" empty={sheets.modifications.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>CLIENT</TableHead>
                  <TableHead>NOM</TableHead>
                  <TableHead>TELEPHONE</TableHead>
                  <TableHead>PACKAGE ACTUEL</TableHead>
                  <TableHead>NEW DATA PACKAGE</TableHead>
                  <TableHead>PACKAGE CHANGE</TableHead>
                  <TableHead>TO APPLY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.modifications.map((row, index) => (
                  <TableRow key={`${row.nom}-${row.telephone}-${index}`}>
                    <TableCell>{row.account || '—'}</TableCell>
                    <TableCell>{row.client}</TableCell>
                    <TableCell>{row.nom}</TableCell>
                    <TableCell>{row.telephone}</TableCell>
                    <TableCell>{row.currentPackage || '—'}</TableCell>
                    <TableCell>{row.newDataPackage || '—'}</TableCell>
                    <TableCell>{row.packageChange || '—'}</TableCell>
                    <TableCell>{row.toApply}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title="Removal" empty={sheets.removals.length === 0}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>DATE DE PRISE D&apos;EFFET</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheets.removals.map((row, index) => (
                  <TableRow key={`${row.nom}-${row.numero}-${index}`}>
                    <TableCell>{row.nom}</TableCell>
                    <TableCell>{row.numero}</TableCell>
                    <TableCell>{row.action}</TableCell>
                    <TableCell>{row.effectDate || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </>
      )}
    </div>
  )
}
