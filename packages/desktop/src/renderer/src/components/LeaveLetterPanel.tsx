import { useCallback, useEffect, useState } from 'react'
import { createApiClient } from '../api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type Holiday = { id: number; month: number; day: number; name: string; active: boolean }
type TravelBand = {
  id: number
  minCategory: number
  maxCategory: number
  amount: number
  effectiveFrom: string
  effectiveTo: string | null
  active: boolean
}
type Settings = {
  saturdayWorking: boolean
  delegationPreface: string
  delegationName: string
  delegationTitle: string
  signCategory9: string
  ccBelow: string
  ccCategory9: string
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

export function LeaveLetterPanel() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [bands, setBands] = useState<TravelBand[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [bandId, setBandId] = useState<number | null>(null)
  const [bandForm, setBandForm] = useState({
    minCategory: '1',
    maxCategory: '6',
    amount: '10000',
    effectiveFrom: '',
    effectiveTo: '',
    active: true,
  })
  const [holidayMonth, setHolidayMonth] = useState('1')
  const [holidayDay, setHolidayDay] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const client = await createApiClient()
    const [holidayRes, settingRes, bandRes] = await Promise.all([
      client.leave.holidays.$get(),
      client.leave['letter-settings'].$get(),
      client.leave['travel-allowances'].$get(),
    ])
    if (holidayRes.ok) setHolidays((await holidayRes.json()) as Holiday[])
    if (settingRes.ok) setSettings((await settingRes.json()) as Settings)
    if (bandRes.ok) setBands((await bandRes.json()) as TravelBand[])
  }, [])

  useEffect(() => {
    void load().catch((err) =>
      setStatus(err instanceof Error ? err.message : String(err)),
    )
  }, [load])

  async function addHoliday() {
    if (!holidayDay || !holidayName.trim()) return
    setSaving(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.leave.holidays.$post({
        json: {
          month: Number(holidayMonth),
          day: Number(holidayDay),
          name: holidayName.trim(),
          active: true,
        },
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not add the holiday'))
      setHolidayDay('')
      setHolidayName('')
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function removeHoliday(id: number) {
    setSaving(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.leave.holidays[':id'].$delete({
        param: { id: String(id) },
      })
      if (!res.ok) throw new Error(await readError(res, 'Could not remove the holiday'))
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function saveSettings() {
    if (!settings) return
    setSaving(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const res = await client.leave['letter-settings'].$put({ json: settings })
      if (!res.ok) throw new Error(await readError(res, 'Could not save letter settings'))
      setSettings((await res.json()) as Settings)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  function setField(key: keyof Settings, value: string) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function blankBand() {
    setBandId(null)
    setBandForm({
      minCategory: '1',
      maxCategory: '6',
      amount: '10000',
      effectiveFrom: '',
      effectiveTo: '',
      active: true,
    })
  }

  async function saveBand() {
    if (!bandForm.effectiveFrom) {
      setStatus('Effective from is required')
      return
    }
    setSaving(true)
    setStatus(null)
    try {
      const client = await createApiClient()
      const json = {
        minCategory: Number(bandForm.minCategory),
        maxCategory: Number(bandForm.maxCategory),
        amount: Number(bandForm.amount),
        effectiveFrom: bandForm.effectiveFrom,
        effectiveTo: bandForm.effectiveTo.trim() || null,
        active: bandForm.active,
      }
      const res =
        bandId == null
          ? await client.leave['travel-allowances'].$post({ json })
          : await client.leave['travel-allowances'][':id'].$patch({
              param: { id: String(bandId) },
              json,
            })
      if (!res.ok) throw new Error(await readError(res, 'Could not save the allowance'))
      blankBand()
      await load()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium">Public holidays and leave letters</h2>
      {status ? (
        <p className="text-sm text-destructive">{status}</p>
      ) : null}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void addHoliday()
        }}
      >
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={holidayMonth}
          onChange={(event) => setHolidayMonth(event.target.value)}
        >
          {MONTHS.map((name, index) => (
            <option key={name} value={String(index + 1)}>
              {name}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min={1}
          max={31}
          placeholder="Day"
          className="w-20"
          value={holidayDay}
          onChange={(event) => setHolidayDay(event.target.value)}
        />
        <Input
          placeholder="Holiday name"
          value={holidayName}
          onChange={(event) => setHolidayName(event.target.value)}
        />
        <Button type="submit" size="sm" variant="outline" disabled={saving}>
          Add holiday
        </Button>
      </form>
      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Every year</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {holidays.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground">
                  No public holidays. Sundays are always skipped.
                </TableCell>
              </TableRow>
            ) : (
              holidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>
                    {holiday.day} {MONTHS[holiday.month - 1]}
                  </TableCell>
                  <TableCell>{holiday.name}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => void removeHoliday(holiday.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {settings ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.saturdayWorking}
            onChange={(event) =>
              setSettings((prev) =>
                prev ? { ...prev, saturdayWorking: event.target.checked } : prev,
              )
            }
          />
          Saturday is a working day
        </label>
      ) : null}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Leave travel allowance</h3>
        <div className="overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From category</TableHead>
                <TableHead>To category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    No allowance bands yet.
                  </TableCell>
                </TableRow>
              ) : (
                bands.map((band) => (
                  <TableRow key={band.id}>
                    <TableCell>{band.minCategory}</TableCell>
                    <TableCell>{band.maxCategory}</TableCell>
                    <TableCell>{band.amount.toLocaleString('en-US')}</TableCell>
                    <TableCell>{band.effectiveFrom.slice(0, 10)}</TableCell>
                    <TableCell>
                      {band.effectiveTo ? band.effectiveTo.slice(0, 10) : '—'}
                    </TableCell>
                    <TableCell>{band.active ? 'Yes' : 'No'}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBandId(band.id)
                          setBandForm({
                            minCategory: String(band.minCategory),
                            maxCategory: String(band.maxCategory),
                            amount: String(band.amount),
                            effectiveFrom: band.effectiveFrom.slice(0, 10),
                            effectiveTo: band.effectiveTo?.slice(0, 10) ?? '',
                            active: band.active,
                          })
                        }}
                      >
                        Change
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <form
          className="grid gap-2 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault()
            void saveBand()
          }}
        >
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">From category</span>
            <Input
              type="number"
              value={bandForm.minCategory}
              onChange={(event) =>
                setBandForm((prev) => ({ ...prev, minCategory: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">To category</span>
            <Input
              type="number"
              value={bandForm.maxCategory}
              onChange={(event) =>
                setBandForm((prev) => ({ ...prev, maxCategory: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Amount (frs)</span>
            <Input
              type="number"
              value={bandForm.amount}
              onChange={(event) =>
                setBandForm((prev) => ({ ...prev, amount: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Effective from</span>
            <Input
              type="date"
              value={bandForm.effectiveFrom}
              onChange={(event) =>
                setBandForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Effective to</span>
            <Input
              type="date"
              value={bandForm.effectiveTo}
              onChange={(event) =>
                setBandForm((prev) => ({ ...prev, effectiveTo: event.target.value }))
              }
            />
          </label>
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
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {bandId == null ? 'Add band' : 'Save band'}
            </Button>
            {bandId != null ? (
              <Button type="button" size="sm" variant="outline" onClick={blankBand}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </div>
      {settings ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Delegation signatory</span>
            <Input
              value={settings.delegationName}
              onChange={(event) => setField('delegationName', event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Delegation preface</span>
            <Input
              value={settings.delegationPreface}
              onChange={(event) => setField('delegationPreface', event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">Delegation title</span>
            <Input
              value={settings.delegationTitle}
              onChange={(event) => setField('delegationTitle', event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">CC below category 9</span>
            <Textarea
              rows={3}
              value={settings.ccBelow}
              onChange={(event) => setField('ccBelow', event.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="text-muted-foreground">CC category 9 and above</span>
            <Textarea
              rows={3}
              value={settings.ccCategory9}
              onChange={(event) => setField('ccCategory9', event.target.value)}
            />
          </label>
          <div>
            <Button type="button" disabled={saving} onClick={() => void saveSettings()}>
              Save letter settings
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
