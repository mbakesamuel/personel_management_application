import type {
  SectionThroAssignment,
  SectionThroBatchInput,
  SectionThroListQuery,
  SectionThroUpsertInput,
} from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class SectionThroNotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message)
    this.name = 'SectionThroNotFoundError'
  }
}

export class SectionThroValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SectionThroValidationError'
  }
}

function toDateOnly(value: Date | null | undefined): string {
  if (!value) return ''
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateInput(value: string): Date {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12),
    )
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new SectionThroValidationError('Effective date is invalid')
  }
  return date
}

async function hydrateAssignments(
  rows: {
    id: number
    tbl_section_id: number
    signatory: string
    title: string
    effdate: Date
  }[],
): Promise<SectionThroAssignment[]> {
  const sectionIds = [...new Set(rows.map((r) => r.tbl_section_id))]
  const sections = sectionIds.length
    ? await prisma.tbl_section.findMany({
        where: { id: { in: sectionIds } },
        select: { id: true, section: true },
      })
    : []
  const sectionNameById = new Map(sections.map((s) => [s.id, s.section]))

  return rows.map((row) => ({
    id: row.id,
    sectionId: row.tbl_section_id,
    sectionName: sectionNameById.get(row.tbl_section_id) ?? null,
    name: row.signatory,
    title: row.title,
    effdate: toDateOnly(row.effdate),
  }))
}

async function normalizeInput(input: SectionThroUpsertInput): Promise<{
  sectionId: number
  name: string
  title: string
  effdate: Date
}> {
  const name = input.name.trim()
  const title = input.title.trim()
  if (!name) {
    throw new SectionThroValidationError('Name is required')
  }
  if (!title) {
    throw new SectionThroValidationError('Title is required')
  }

  const section = await prisma.tbl_section.findUnique({
    where: { id: input.sectionId },
    select: { id: true },
  })
  if (!section) {
    throw new SectionThroValidationError(
      `Section ${input.sectionId} was not found`,
    )
  }

  return {
    sectionId: input.sectionId,
    name,
    title,
    effdate: parseDateInput(input.effdate),
  }
}

async function assertNoSameDateOverlap(
  data: { sectionId: number; effdate: Date },
  excludeId?: number,
): Promise<void> {
  const targetDate = toDateOnly(data.effdate)
  const rows = await prisma.tbl_section_thro.findMany({
    where: {
      tbl_section_id: data.sectionId,
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: { signatory: true, effdate: true },
  })
  const clash = rows.find((row) => toDateOnly(row.effdate) === targetDate)
  if (!clash) return
  throw new SectionThroValidationError(
    `This section already has a Through holder effective ${targetDate} (${clash.signatory}).`,
  )
}

function mapWriteError(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new SectionThroValidationError(
      'Another holder is already assigned to this section on that effective date.',
    )
  }
  throw err
}

export async function listSectionThroAssignments(
  query: SectionThroListQuery,
): Promise<SectionThroAssignment[]> {
  let sectionIds: number[] | undefined
  if (query.sectionId != null) {
    sectionIds = [query.sectionId]
  } else if (query.unitId?.trim()) {
    const sections = await prisma.tbl_section.findMany({
      where: { tbl_unit_id: query.unitId.trim() },
      select: { id: true },
    })
    sectionIds = sections.map((section) => section.id)
    if (sectionIds.length === 0) return []
  } else {
    throw new SectionThroValidationError('sectionId or unitId is required')
  }

  const rows = await prisma.tbl_section_thro.findMany({
    where: { tbl_section_id: { in: sectionIds } },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })
  return hydrateAssignments(rows)
}

export async function batchUpsertSectionThroAssignments(
  input: SectionThroBatchInput,
): Promise<{ saved: number }> {
  const normalized: Array<{
    sectionId: number
    name: string
    title: string
    effdate: Date
  }> = []
  for (const row of input.rows) {
    normalized.push(await normalizeInput(row))
  }

  await prisma.$transaction(async (tx) => {
    for (const data of normalized) {
      const existing = await tx.tbl_section_thro.findMany({
        where: { tbl_section_id: data.sectionId },
        select: { id: true, effdate: true },
      })
      const match = existing.find(
        (row) => toDateOnly(row.effdate) === toDateOnly(data.effdate),
      )
      if (match) {
        await tx.tbl_section_thro.update({
          where: { id: match.id },
          data: {
            signatory: data.name,
            title: data.title,
            effdate: data.effdate,
          },
        })
      } else {
        await tx.tbl_section_thro.create({
          data: {
            tbl_section_id: data.sectionId,
            signatory: data.name,
            title: data.title,
            effdate: data.effdate,
          },
        })
      }
    }
  })

  return { saved: normalized.length }
}

export async function createSectionThroAssignment(
  input: SectionThroUpsertInput,
): Promise<SectionThroAssignment> {
  const data = await normalizeInput(input)
  await assertNoSameDateOverlap(data)
  try {
    const row = await prisma.tbl_section_thro.create({
      data: {
        tbl_section_id: data.sectionId,
        signatory: data.name,
        title: data.title,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateAssignments([row])
    return item
  } catch (err) {
    mapWriteError(err)
  }
}

export async function updateSectionThroAssignment(
  id: number,
  input: SectionThroUpsertInput,
): Promise<SectionThroAssignment> {
  const data = await normalizeInput(input)
  await assertNoSameDateOverlap(data, id)
  try {
    const row = await prisma.tbl_section_thro.update({
      where: { id },
      data: {
        tbl_section_id: data.sectionId,
        signatory: data.name,
        title: data.title,
        effdate: data.effdate,
      },
    })
    const [item] = await hydrateAssignments([row])
    return item
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new SectionThroNotFoundError('Assignment not found')
    }
    mapWriteError(err)
  }
}

export async function deleteSectionThroAssignment(id: number): Promise<void> {
  try {
    await prisma.tbl_section_thro.delete({ where: { id } })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new SectionThroNotFoundError('Assignment not found')
    }
    throw err
  }
}

export async function resolveSectionThroTitle(input: {
  sectionId: number | null
  asOf: Date
}): Promise<string> {
  if (input.sectionId == null) return 'HEAD OF SECTION'

  const assignment = await prisma.tbl_section_thro.findFirst({
    where: {
      tbl_section_id: input.sectionId,
      effdate: { lte: input.asOf },
    },
    orderBy: [{ effdate: 'desc' }, { id: 'desc' }],
  })

  const title = assignment?.title?.trim()
  return (title || 'HEAD OF SECTION').toUpperCase()
}
