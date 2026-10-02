import {
  type CommunicationBatchReport,
  type CommunicationBatchSummary,
} from '@personel-management-app/shared'
import { X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import { LetterPdfOverlay } from './LetterPdfOverlay'
import { batchReportDocument } from './OrangeOperatorMemo'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type AllowanceChangeLettersConsoleProps = {
  onClose: () => void
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function AllowanceChangeLettersConsole({
  onClose,
}: AllowanceChangeLettersConsoleProps) {
  const [batches, setBatches] = useState<CommunicationBatchSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [letter, setLetter] = useState<{ html: string; title: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.communication.batches.$get({ query: {} })
      if (!res.ok) throw new Error(await readError(res, 'Failed to load reports'))
      setBatches((await res.json()) as CommunicationBatchSummary[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function openReport(id: number) {
    setStatus(null)
    setLoading(true)
    try {
      const client = await createApiClient()
      const res = await client.communication.batches[':id'].$get({
        param: { id: String(id) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Failed to open report'))
      setLetter(batchReportDocument((await res.json()) as CommunicationBatchReport))
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to open report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Allowance Change Letters</h1>
            <p className="text-sm text-muted-foreground">
              Saved modification, removal, and inclusion letters.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            <X className="size-4" />
            Close
          </Button>
        </div>

        {status ? <p className="mb-3 text-sm text-destructive">{status}</p> : null}

        {loading && batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved letters yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Modifications</TableHead>
                <TableHead>Removals</TableHead>
                <TableHead>Inclusions</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.createdAt}</TableCell>
                  <TableCell>{row.operatorName}</TableCell>
                  <TableCell>{row.modificationCount}</TableCell>
                  <TableCell>{row.removalCount}</TableCell>
                  <TableCell>{row.inclusionCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void openReport(row.id)}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
