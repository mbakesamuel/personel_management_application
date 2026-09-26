import type {
  SalaryReviewImportBatchInput,
  SalaryReviewImportResult,
  SalaryReviewImportRow,
} from '@perf-appraisal-app/shared'
import { prisma } from '../db.js'

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

function parseDateInput(value: string | null | undefined): Date | null {
  const raw = emptyToNull(value)
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
    )
  }
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${raw}`)
  }
  return date
}

function pairKey(matric: string, appyear: number): string {
  return `${appyear}\t${matric}`
}

export async function importSalaryReviewBatch(
  input: SalaryReviewImportBatchInput,
): Promise<SalaryReviewImportResult> {
  const errors: { row: number; message: string }[] = []
  const byPair = new Map<string, SalaryReviewImportRow>()

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    if (!row) continue
    try {
      parseDateInput(row.dateeng)
      parseDateInput(row.date_lpro)
      parseDateInput(row.date_lmer)
      parseDateInput(row.date_lstat)
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : String(err),
      })
      continue
    }
    byPair.set(pairKey(row.matric, row.appyear), row)
  }

  const uniqueRows = [...byPair.values()]
  if (uniqueRows.length === 0) {
    return {
      inserted: 0,
      replaced: 0,
      skipped: input.rows.length,
      errors,
    }
  }

  const orFilter = uniqueRows.map((row) => ({
    matric: row.matric,
    appyear: row.appyear,
  }))

  const existing = await prisma.tbl_salaryreview.findMany({
    where: { OR: orFilter },
    select: { matric: true, appyear: true },
  })
  const existingPairs = new Set(
    existing
      .filter((row) => row.matric != null && row.appyear != null)
      .map((row) => pairKey(row.matric as string, row.appyear as number)),
  )
  const replaced = uniqueRows.filter((row) =>
    existingPairs.has(pairKey(row.matric, row.appyear)),
  ).length

  await prisma.tbl_salaryreview.deleteMany({ where: { OR: orFilter } })

  const data = uniqueRows.map((row) => ({
    appyear: row.appyear,
    matric: row.matric,
    names: emptyToNull(row.names),
    tbl_section_id: row.tbl_section_id ?? null,
    designation: emptyToNull(row.designation),
    dateeng: parseDateInput(row.dateeng),
    lengthservice: emptyToNull(row.lengthservice),
    date_lpro: parseDateInput(row.date_lpro),
    date_lmer: parseDateInput(row.date_lmer),
    date_lstat: parseDateInput(row.date_lstat),
    precat: emptyToNull(row.precat),
    procat: emptyToNull(row.procat),
    presalary: row.presalary ?? null,
    prosalary: row.prosalary ?? null,
    finincmonth: row.finincmonth ?? null,
    finincyear: row.finincyear ?? null,
    award: emptyToNull(row.award),
  }))

  await prisma.tbl_salaryreview.createMany({ data })

  return {
    inserted: data.length,
    replaced,
    skipped: input.rows.length - uniqueRows.length,
    errors,
  }
}
