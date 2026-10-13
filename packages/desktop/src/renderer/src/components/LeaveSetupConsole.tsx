import type { User } from '@personel-management-app/shared'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createApiClient } from '../api/client'
import { formatDisplayDate } from '../lib/format-date'
import { LeaveLetterPanel } from './LeaveLetterPanel'
import {
  FormDialog,
  FormDialogActions,
  FormDialogError,
  FormDialogRow,
} from './form-dialog'
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

type LeaveSetupConsoleProps = {
  currentUser: User
  onClose: () => void
}

type PolicyRow = {
  id: number
  code: string
  name: string
  method: 'METHOD_1' | 'METHOD_2'
  effectiveFrom: string
  active: boolean
}
type EntitlementRow = {
  id: number
  annualDays: number
  effectiveFrom: string
  active: boolean
}
type RateRow = {
  id: number
  monthlyDays: number
  effectiveFrom: string
  active: boolean
}
type SeniorityRow = {
  id: number
  minYears: number
  maxYears: number | null
  bonusDays: number
  effectiveFrom: string
  active: boolean
}

function day(value: string) {
  return value?.slice(0, 10) ?? ''
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function LeaveSetupConsole({ onClose }: LeaveSetupConsoleProps) {
  const [status, setStatus] = useState<string | null>(null)
  const [policies, setPolicies] = useState<PolicyRow[]>([])
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([])
  const [rates, setRates] = useState<RateRow[]>([])
  const [bands, setBands] = useState<SeniorityRow[]>([])
  const [motherForm, setMotherForm] = useState({
    daysPerChild: '0',
    maxAgeYears: '0',
  })
  const [motherSaving, setMotherSaving] = useState(false)
  const [motherStatus, setMotherStatus] = useState<string | null>(null)
  const [supplyLastResumption, setSupplyLastResumption] = useState(false)
  const [supplySaving, setSupplySaving] = useState(false)
  const [supplyStatus, setSupplyStatus] = useState<string | null>(null)
  const [open, setOpen] = useState<
    'policy' | 'entitlement' | 'rate' | 'seniority' | null
  >(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [policyForm, setPolicyForm] = useState({
    code: '',
    name: '',
    method: 'METHOD_1' as 'METHOD_1' | 'METHOD_2',
    effectiveFrom: '',
    active: true,
  })
  const [entitlementForm, setEntitlementForm] = useState({
    annualDays: '18',
    effectiveFrom: '',
    active: true,
  })
  const [rateForm, setRateForm] = useState({
    monthlyDays: '1.5',
    effectiveFrom: '',
    active: true,
  })
  const [bandForm, setBandForm] = useState({
    minYears: '0',
    maxYears: '',
    bonusDays: '0',
    effectiveFrom: '',
    active: true,
  })

  const load = useCallback(async () => {
    setStatus(null)
    try {
      const client = await createApiClient()
      const [policyRes, entitlementRes, rateRes, bandRes, motherRes, supplyRes] =
        await Promise.all([
          client.leave.policies.$get(),
          client.leave['entitlement-rules'].$get(),
          client.leave['monthly-rate-rules'].$get(),
          client.leave['seniority-rules'].$get(),
          client.leave['mother-settings'].$get(),
          client.leave['processing-settings'].$get(),
        ])
      if (!policyRes.ok) throw new Error(await readError(policyRes, 'Failed to load policies'))
      if (!entitlementRes.ok) {
        throw new Error(await readError(entitlementRes, 'Failed to load entitlement'))
      }
      if (!rateRes.ok) throw new Error(await readError(rateRes, 'Failed to load rates'))
      if (!bandRes.ok) throw new Error(await readError(bandRes, 'Failed to load seniority'))
      if (!motherRes.ok) {
        throw new Error(await readError(motherRes, "Failed to load mother's leave"))
      }
      if (!supplyRes.ok) {
        throw new Error(await readError(supplyRes, 'Failed to load leave settings'))
      }
      const supply = (await supplyRes.json()) as {
        userSupplyLastResumption: boolean
      }
      setSupplyLastResumption(supply.userSupplyLastResumption)
      const mother = (await motherRes.json()) as {
        daysPerChild: number
        maxAgeYears: number
      }
      setMotherForm({
        daysPerChild: String(mother.daysPerChild),
        maxAgeYears: String(mother.maxAgeYears),
      })
      setPolicies((await policyRes.json()) as PolicyRow[])
      setEntitlements((await entitlementRes.json()) as EntitlementRow[])
      setRates((await rateRes.json()) as RateRow[])
      setBands((await bandRes.json()) as SeniorityRow[])
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveSupply() {
    setSupplySaving(true)
    setSupplyStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.leave['processing-settings'].$put({
        json: { userSupplyLastResumption: supplyLastResumption },
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      const saved = (await res.json()) as { userSupplyLastResumption: boolean }
      setSupplyLastResumption(saved.userSupplyLastResumption)
      setSupplyStatus('Saved')
    } catch (err) {
      setSupplyStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSupplySaving(false)
    }
  }

  async function saveMother() {
    setMotherSaving(true)
    setMotherStatus(null)
    try {
      const daysPerChild = Number(motherForm.daysPerChild)
      const maxAgeYears = Number(motherForm.maxAgeYears)
      if (
        !Number.isInteger(daysPerChild) ||
        daysPerChild < 0 ||
        !Number.isInteger(maxAgeYears) ||
        maxAgeYears < 0
      ) {
        throw new Error('Days per child and age limit must be whole numbers of 0 or more')
      }
      const client = await createApiClient()
      const res = await client.leave['mother-settings'].$put({
        json: { daysPerChild, maxAgeYears },
      })
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      const saved = (await res.json()) as {
        daysPerChild: number
        maxAgeYears: number
      }
      setMotherForm({
        daysPerChild: String(saved.daysPerChild),
        maxAgeYears: String(saved.maxAgeYears),
      })
    } catch (err) {
      setMotherStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setMotherSaving(false)
    }
  }

  async function save() {
    setSaving(true)
    setFormError(null)
    try {
      const client = await createApiClient()
      const param = editingId == null ? null : { id: String(editingId) }
      let res: Response
      if (open === 'policy') {
        const json = { ...policyForm }
        res = param
          ? await client.leave.policies[':id'].$patch({ param, json })
          : await client.leave.policies.$post({ json })
      } else if (open === 'entitlement') {
        const json = {
          annualDays: Number(entitlementForm.annualDays),
          effectiveFrom: entitlementForm.effectiveFrom,
          active: entitlementForm.active,
        }
        res = param
          ? await client.leave['entitlement-rules'][':id'].$patch({ param, json })
          : await client.leave['entitlement-rules'].$post({ json })
      } else if (open === 'rate') {
        const json = {
          monthlyDays: Number(rateForm.monthlyDays),
          effectiveFrom: rateForm.effectiveFrom,
          active: rateForm.active,
        }
        res = param
          ? await client.leave['monthly-rate-rules'][':id'].$patch({ param, json })
          : await client.leave['monthly-rate-rules'].$post({ json })
      } else {
        const json = {
          minYears: Number(bandForm.minYears),
          maxYears: bandForm.maxYears.trim() ? Number(bandForm.maxYears) : null,
          bonusDays: Number(bandForm.bonusDays),
          effectiveFrom: bandForm.effectiveFrom,
          active: bandForm.active,
        }
        res = param
          ? await client.leave['seniority-rules'][':id'].$patch({ param, json })
          : await client.leave['seniority-rules'].$post({ json })
      }
      if (!res.ok) throw new Error(await readError(res, 'Save failed'))
      setOpen(null)
      setEditingId(null)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Leave setup</h1>
          <p className="text-sm text-muted-foreground">
            Calculation policy and the rules used for leave due.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      {status ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {status}
        </p>
      ) : null}

      <Section
        title="Calculation policy"
        onAdd={() => {
          setEditingId(null)
          setPolicyForm({
            code: '',
            name: '',
            method: 'METHOD_1',
            effectiveFrom: '',
            active: true,
          })
          setFormError(null)
          setOpen('policy')
        }}
      >
        <SimpleTable
          headers={['Code', 'Name', 'Method', 'From', 'Active']}
          rows={policies.map((row) => [
            row.code,
            row.name,
            row.method,
            formatDisplayDate(row.effectiveFrom),
            row.active ? 'Yes' : 'No',
          ])}
          onEdit={(index) => {
            const row = policies[index]
            if (!row) return
            setEditingId(row.id)
            setPolicyForm({
              code: row.code,
              name: row.name,
              method: row.method,
              effectiveFrom: day(row.effectiveFrom),
              active: row.active,
            })
            setFormError(null)
            setOpen('policy')
          }}
        />
      </Section>
      <Section
        title="Entitlement (method 1 basic days)"
        onAdd={() => {
          setEditingId(null)
          setEntitlementForm({ annualDays: '18', effectiveFrom: '', active: true })
          setFormError(null)
          setOpen('entitlement')
        }}
      >
        <SimpleTable
          headers={['Annual days', 'From', 'Active']}
          rows={entitlements.map((row) => [
            String(row.annualDays),
            formatDisplayDate(row.effectiveFrom),
            row.active ? 'Yes' : 'No',
          ])}
          onEdit={(index) => {
            const row = entitlements[index]
            if (!row) return
            setEditingId(row.id)
            setEntitlementForm({
              annualDays: String(row.annualDays),
              effectiveFrom: day(row.effectiveFrom),
              active: row.active,
            })
            setFormError(null)
            setOpen('entitlement')
          }}
        />
      </Section>
      <Section
        title="Monthly rate (method 2)"
        onAdd={() => {
          setEditingId(null)
          setRateForm({ monthlyDays: '1.5', effectiveFrom: '', active: true })
          setFormError(null)
          setOpen('rate')
        }}
      >
        <SimpleTable
          headers={['Days per month', 'From', 'Active']}
          rows={rates.map((row) => [
            String(row.monthlyDays),
            formatDisplayDate(row.effectiveFrom),
            row.active ? 'Yes' : 'No',
          ])}
          onEdit={(index) => {
            const row = rates[index]
            if (!row) return
            setEditingId(row.id)
            setRateForm({
              monthlyDays: String(row.monthlyDays),
              effectiveFrom: day(row.effectiveFrom),
              active: row.active,
            })
            setFormError(null)
            setOpen('rate')
          }}
        />
      </Section>
      <Section
        title="Seniority bands"
        onAdd={() => {
          setEditingId(null)
          setBandForm({
            minYears: '0',
            maxYears: '',
            bonusDays: '0',
            effectiveFrom: '',
            active: true,
          })
          setFormError(null)
          setOpen('seniority')
        }}
      >
        <SimpleTable
          headers={['From years', 'To years', 'Bonus days', 'From', 'Active']}
          rows={bands.map((row) => [
            String(row.minYears),
            row.maxYears == null ? 'and above' : String(row.maxYears),
            String(row.bonusDays),
            formatDisplayDate(row.effectiveFrom),
            row.active ? 'Yes' : 'No',
          ])}
          onEdit={(index) => {
            const row = bands[index]
            if (!row) return
            setEditingId(row.id)
            setBandForm({
              minYears: String(row.minYears),
              maxYears: row.maxYears == null ? '' : String(row.maxYears),
              bonusDays: String(row.bonusDays),
              effectiveFrom: day(row.effectiveFrom),
              active: row.active,
            })
            setFormError(null)
            setOpen('seniority')
          }}
        />
      </Section>

      <section className="space-y-2 rounded-xl border bg-card p-4 text-card-foreground">
        <div>
          <h2 className="text-sm font-medium">Last resumption</h2>
          <p className="text-sm text-muted-foreground">
            When there is no leave history yet, let staff enter the last resumed
            date on Apply leave. Off by default.
          </p>
        </div>
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void saveSupply()
          }}
        >
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={supplyLastResumption}
              onChange={(event) => {
                setSupplyLastResumption(event.target.checked)
                setSupplyStatus(null)
              }}
            />
            Users supply the last resumed date
          </label>
          <Button type="submit" size="sm" disabled={supplySaving}>
            {supplySaving ? 'Saving…' : 'Save'}
          </Button>
        </form>
        {supplyStatus ? (
          <p className="text-sm text-muted-foreground">{supplyStatus}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Mother&apos;s leave</h2>
        <p className="text-sm text-muted-foreground">
          Female personnel receive this many days for each validated child who
          has not yet completed the age limit on the application date.
        </p>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void saveMother()
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Days per child (m)</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={motherForm.daysPerChild}
              onChange={(event) =>
                setMotherForm((prev) => ({
                  ...prev,
                  daysPerChild: event.target.value,
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Age limit in years (n)</span>
            <Input
              type="number"
              min={0}
              step={1}
              value={motherForm.maxAgeYears}
              onChange={(event) =>
                setMotherForm((prev) => ({
                  ...prev,
                  maxAgeYears: event.target.value,
                }))
              }
            />
          </label>
          <Button type="submit" size="sm" disabled={motherSaving}>
            {motherSaving ? 'Saving…' : 'Save'}
          </Button>
        </form>
        {motherStatus ? (
          <p className="text-sm text-destructive">{motherStatus}</p>
        ) : null}
      </section>

      <LeaveLetterPanel />

      <FormDialog
        open={open != null}
        onOpenChange={(next) => {
          if (!next) {
            setOpen(null)
            setEditingId(null)
          }
        }}
        title={
          `${editingId == null ? 'Add' : 'Change'} ${
            open === 'policy'
              ? 'policy'
              : open === 'entitlement'
                ? 'entitlement'
                : open === 'rate'
                  ? 'monthly rate'
                  : 'seniority band'
          }`
        }
      >
        <FormDialogError>{formError}</FormDialogError>
        {open === 'policy' ? (
          <>
            <FormDialogRow label="Code" htmlFor="leave-policy-code">
              <Input
                id="leave-policy-code"
                value={policyForm.code}
                onChange={(event) =>
                  setPolicyForm((prev) => ({ ...prev, code: event.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Name" htmlFor="leave-policy-name">
              <Input
                id="leave-policy-name"
                value={policyForm.name}
                onChange={(event) =>
                  setPolicyForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Method" htmlFor="leave-policy-method">
              <Select
                value={policyForm.method}
                onValueChange={(value) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    method: value as 'METHOD_1' | 'METHOD_2',
                  }))
                }
              >
                <SelectTrigger id="leave-policy-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="METHOD_1">Method 1</SelectItem>
                  <SelectItem value="METHOD_2">Method 2</SelectItem>
                </SelectContent>
              </Select>
            </FormDialogRow>
            <FormDialogRow label="Effective from" htmlFor="leave-policy-from">
              <Input
                id="leave-policy-from"
                type="date"
                value={policyForm.effectiveFrom}
                onChange={(event) =>
                  setPolicyForm((prev) => ({
                    ...prev,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={policyForm.active}
                onChange={(event) =>
                  setPolicyForm((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              Active
            </label>
          </>
        ) : null}
        {open === 'entitlement' ? (
          <>
            <FormDialogRow label="Annual days" htmlFor="leave-annual">
              <Input
                id="leave-annual"
                type="number"
                value={entitlementForm.annualDays}
                onChange={(event) =>
                  setEntitlementForm((prev) => ({
                    ...prev,
                    annualDays: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Effective from" htmlFor="leave-annual-from">
              <Input
                id="leave-annual-from"
                type="date"
                value={entitlementForm.effectiveFrom}
                onChange={(event) =>
                  setEntitlementForm((prev) => ({
                    ...prev,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={entitlementForm.active}
                onChange={(event) =>
                  setEntitlementForm((prev) => ({
                    ...prev,
                    active: event.target.checked,
                  }))
                }
              />
              Active
            </label>
          </>
        ) : null}
        {open === 'rate' ? (
          <>
            <FormDialogRow label="Days per month" htmlFor="leave-rate">
              <Input
                id="leave-rate"
                type="number"
                step="0.0001"
                value={rateForm.monthlyDays}
                onChange={(event) =>
                  setRateForm((prev) => ({
                    ...prev,
                    monthlyDays: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Effective from" htmlFor="leave-rate-from">
              <Input
                id="leave-rate-from"
                type="date"
                value={rateForm.effectiveFrom}
                onChange={(event) =>
                  setRateForm((prev) => ({
                    ...prev,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rateForm.active}
                onChange={(event) =>
                  setRateForm((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              Active
            </label>
          </>
        ) : null}
        {open === 'seniority' ? (
          <>
            <FormDialogRow label="From years" htmlFor="leave-min-years">
              <Input
                id="leave-min-years"
                type="number"
                value={bandForm.minYears}
                onChange={(event) =>
                  setBandForm((prev) => ({ ...prev, minYears: event.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="To years" htmlFor="leave-max-years">
              <Input
                id="leave-max-years"
                type="number"
                placeholder="Blank for and above"
                value={bandForm.maxYears}
                onChange={(event) =>
                  setBandForm((prev) => ({ ...prev, maxYears: event.target.value }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Bonus days" htmlFor="leave-bonus">
              <Input
                id="leave-bonus"
                type="number"
                value={bandForm.bonusDays}
                onChange={(event) =>
                  setBandForm((prev) => ({
                    ...prev,
                    bonusDays: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <FormDialogRow label="Effective from" htmlFor="leave-band-from">
              <Input
                id="leave-band-from"
                type="date"
                value={bandForm.effectiveFrom}
                onChange={(event) =>
                  setBandForm((prev) => ({
                    ...prev,
                    effectiveFrom: event.target.value,
                  }))
                }
              />
            </FormDialogRow>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bandForm.active}
                onChange={(event) =>
                  setBandForm((prev) => ({ ...prev, active: event.target.checked }))
                }
              />
              Active
            </label>
          </>
        ) : null}
        <FormDialogActions
          primaryLabel={saving ? 'Saving…' : 'Save'}
          onPrimary={() => void save()}
          onCancel={() => {
            setOpen(null)
            setEditingId(null)
          }}
          primaryDisabled={saving}
          cancelDisabled={saving}
        />
      </FormDialog>
    </div>
  )
}

function Section({
  title,
  onAdd,
  children,
}: {
  title: string
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          Add
        </Button>
      </div>
      {children}
    </section>
  )
}

function SimpleTable({
  headers,
  rows,
  onEdit,
}: {
  headers: string[]
  rows: string[][]
  onEdit?: (index: number) => void
}) {
  return (
    <div className="overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
            {onEdit ? <TableHead className="w-24" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={headers.length + (onEdit ? 1 : 0)}
                className="text-muted-foreground"
              >
                None yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={index}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex}>{cell}</TableCell>
                ))}
                {onEdit ? (
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(index)}
                    >
                      Change
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
