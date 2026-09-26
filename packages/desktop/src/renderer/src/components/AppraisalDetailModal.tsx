import type {
  AppraisalDetail,
  AwardOption,
  MatricLookupResult,
} from '@perf-appraisal-app/shared'
import { requiresProposedCategoryCalculation } from '@perf-appraisal-app/shared'
import { useEffect, useMemo, useState } from 'react'
import { createApiClient } from '../api/client'
import { formatDisplayDate } from '../lib/format-date'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Mode = 'create' | 'edit'

type AppraisalDetailModalProps = {
  open: boolean
  mode: Mode
  appyear: number
  appraisalId: number | null
  awards: AwardOption[]
  onClose: () => void
  onSaved: () => void
}

const NONE_VALUE = '__none__'

const emptyDetail = (appyear: number): AppraisalDetail => ({
  id: null,
  appyear,
  matric: '',
  names: null,
  preCat: null,
  proCat: null,
  dateLmerit: null,
  dateLstat: null,
  dateLpro: null,
  awardId: null,
  lengthservice: null,
  employee: {
    section: null,
    designation: null,
    dateEngaged: null,
    dateOfBirth: null,
    presentAge: null,
    lengthService: null,
  },
})

export function AppraisalDetailModal({
  open,
  mode,
  appyear,
  appraisalId,
  awards,
  onClose,
  onSaved,
}: AppraisalDetailModalProps) {
  const [form, setForm] = useState<AppraisalDetail>(emptyDetail(appyear))
  const [eligibleAwardIds, setEligibleAwardIds] = useState<number[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const visibleAwards = useMemo(() => {
    if (eligibleAwardIds == null) return awards
    const allowed = new Set(eligibleAwardIds)
    return awards.filter((award) => allowed.has(award.id))
  }, [awards, eligibleAwardIds])

  const selectedAward = useMemo(
    () => awards.find((award) => award.id === form.awardId) ?? null,
    [awards, form.awardId],
  )

  const proCatReadOnly = requiresProposedCategoryCalculation(selectedAward?.award)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function load() {
      setError(null)
      setInfo(null)
      setBusy(true)
      try {
        if (mode === 'edit' && appraisalId != null) {
          const client = await createApiClient()
          const res = await client.appraisals[':id'].$get({
            param: { id: String(appraisalId) },
          })
          if (!res.ok) {
            throw new Error(await res.text())
          }
          const detail = await res.json()
          if (!cancelled) {
            setForm(detail)
            setEligibleAwardIds(null)
          }
        } else {
          if (!cancelled) {
            setForm(emptyDetail(appyear))
            setEligibleAwardIds(null)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, mode, appraisalId, appyear])

  function patch<K extends keyof AppraisalDetail>(key: K, value: AppraisalDetail[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function applyLookupResult(result: MatricLookupResult) {
    const { eligibleAwardIds: eligible, warnings, ...detail } = result
    setEligibleAwardIds(eligible)
    const allowed = new Set(eligible)
    const awardId =
      detail.awardId != null && allowed.has(detail.awardId)
        ? detail.awardId
        : null
    setForm({ ...detail, awardId })
    if (warnings?.length) {
      setError(warnings.join(' '))
    }
  }

  async function lookupMatric() {
    const matric = form.matric.trim()
    if (!matric) {
      setError('Enter a matricule number first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const client = await createApiClient()
      const res = await client.appraisals.lookup.$get({
        query: { matric, appyear: String(appyear), mode: 'create' },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Lookup failed (${res.status})`)
      }
      applyLookupResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleAwardChange(value: string) {
    const awardId = value === NONE_VALUE ? null : Number(value)
    patch('awardId', awardId)
    setError(null)
    setInfo(null)

    if (awardId == null) return

    const award = awards.find((a) => a.id === awardId)
    if (!requiresProposedCategoryCalculation(award?.award)) {
      patch('proCat', form.preCat)
      return
    }

    if (!form.preCat?.trim()) {
      setError(
        'Enter Pre Cat/Ech before selecting an increment or upgrading award.',
      )
      return
    }

    setBusy(true)
    try {
      const client = await createApiClient()
      const res = await client.appraisals['propose-category'].$post({
        json: { preCat: form.preCat.trim(), awardId },
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(body?.error ?? `Proposal failed (${res.status})`)
      }
      const result = await res.json()
      if (result.overflow) {
        setInfo(result.note)
        return
      }
      patch('proCat', result.proCat)
      if (result.note) {
        setInfo(result.note)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleValidate() {
    if (!form.matric.trim()) {
      setError('Matricule number is required.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const client = await createApiClient()
      const payload = {
        id: form.id ?? undefined,
        appyear,
        matric: form.matric.trim(),
        dateLmerit: form.dateLmerit,
        dateLstat: form.dateLstat,
        dateLpro: form.dateLpro,
        lengthservice: form.lengthservice ?? form.employee.lengthService,
        preCat: form.preCat,
        proCat: form.proCat,
        awardId: form.awardId,
      }

      const res =
        form.id != null
          ? await client.appraisals[':id'].$put({
              param: { id: String(form.id) },
              json: payload,
            })
          : await client.appraisals.$post({ json: payload })

      if (!res.ok) {
        throw new Error(await res.text())
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Appraisal Detail</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-40 flex-1 gap-1">
                <Label htmlFor="detail-matric">Matricule No</Label>
                <Input
                  id="detail-matric"
                  value={form.matric}
                  onChange={(e) => patch('matric', e.target.value)}
                  onBlur={() => {
                    if (mode === 'create' && form.matric.trim()) {
                      void lookupMatric()
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mode === 'create') {
                      e.preventDefault()
                      void lookupMatric()
                    }
                  }}
                  disabled={mode === 'edit'}
                />
              </div>
              {mode === 'create' ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void lookupMatric()}
                >
                  ADD NEW
                </Button>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="detail-names">Names</Label>
              <Input id="detail-names" value={form.names ?? ''} readOnly />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="detail-precat">Pre Cat/Ech</Label>
              <Input
                id="detail-precat"
                value={form.preCat ?? ''}
                onChange={(e) => patch('preCat', e.target.value || null)}
              />
            </div>

            <fieldset className="rounded-md border p-3">
              <legend className="px-2 text-sm font-semibold">
                DATE OF LAST (INCREMENTS)
              </legend>
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="detail-merit">Merit</Label>
                  <Input
                    id="detail-merit"
                    type="date"
                    className="w-44"
                    value={form.dateLmerit ?? ''}
                    onChange={(e) => patch('dateLmerit', e.target.value || null)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="detail-stat">Statutory</Label>
                  <Input
                    id="detail-stat"
                    type="date"
                    className="w-44"
                    value={form.dateLstat ?? ''}
                    onChange={(e) => patch('dateLstat', e.target.value || null)}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="detail-pro">Promotion/Rec.</Label>
                  <Input
                    id="detail-pro"
                    type="date"
                    className="w-44"
                    value={form.dateLpro ?? ''}
                    onChange={(e) => patch('dateLpro', e.target.value || null)}
                  />
                </div>
              </div>
            </fieldset>

            <div className="grid gap-1">
              <Label>Unit Manager&apos;s Award</Label>
              <Select
                value={form.awardId != null ? String(form.awardId) : NONE_VALUE}
                onValueChange={(value) => void handleAwardChange(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>—</SelectItem>
                  {visibleAwards.map((award) => (
                    <SelectItem key={award.id} value={String(award.id)}>
                      {award.award ?? `Award #${award.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="detail-procat">Proposed Cat/Ech</Label>
              <Input
                id="detail-procat"
                value={form.proCat ?? ''}
                readOnly={proCatReadOnly}
                onChange={(e) => patch('proCat', e.target.value || null)}
              />
            </div>
          </div>

          <div className="self-start rounded-md border">
            <div className="border-b bg-muted px-3 py-2 text-sm font-semibold">
              Employee Details
            </div>
            <div className="flex flex-col gap-2 p-3">
              {(
                [
                  ['Section', form.employee.section],
                  ['Designation', form.employee.designation],
                  ['Date Engaged', formatDisplayDate(form.employee.dateEngaged)],
                  ['Date of Birth', formatDisplayDate(form.employee.dateOfBirth)],
                  ['Present Age', form.employee.presentAge?.toString() ?? null],
                  [
                    'Length Service',
                    form.lengthservice ?? form.employee.lengthService,
                  ],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid gap-1">
                  <Label>{label}</Label>
                  <Input value={value ?? ''} readOnly />
                </div>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {info ? <p className="text-sm text-muted-foreground">{info}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleValidate()}
          >
            {busy ? 'Saving…' : 'Validate'}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
