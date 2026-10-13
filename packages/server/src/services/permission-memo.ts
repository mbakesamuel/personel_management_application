import {
  leaveMemoFileRef,
  memoDateHtml,
  memoFormDocumentHtml,
  memoFormPageHtml,
  parseCatEchCode,
  type MemoCcLayout,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import {
  slashDate,
  resumptionDate,
  workingEndDate,
} from './leave-memo.js'
import { PersonnelNotFoundError, PersonnelWorkflowError } from './personnel-workflow.js'
import { resolveOfficialMemoSignatory } from './official-memo.service.js'
import { resolveMemoThroTitle } from './section-thro.service.js'

const DAY_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function daysWord(days: number): string {
  if (days < 20) return DAY_WORDS[days] ?? String(days)
  if (days < 100) {
    const ten = TENS[Math.floor(days / 10)] ?? ''
    const one = days % 10
    return one ? `${ten}-${DAY_WORDS[one]}` : ten
  }
  return String(days)
}

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function padDays(days: number): string {
  return String(days).padStart(2, '0')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function todayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function dateOnly(value: Date): string {
  const y = value.getUTCFullYear()
  const m = String(value.getUTCMonth() + 1).padStart(2, '0')
  const d = String(value.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function resolvePermissionSpan(input: {
  matricule: string
  days: number
  startDate: Date
}): Promise<{ endDate: Date; resumeDate: Date }> {
  const [holidays, settings, classification] = await Promise.all([
    prisma.tbl_public_holiday.findMany({
      where: { active: true },
      select: { month: true, day: true },
    }),
    prisma.tbl_leave_letter_setting.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
    prisma.tbl_emp_class.findFirst({
      where: { matricule: input.matricule, workflowStatus: 'VALIDATED' },
      orderBy: [{ letter_date: 'desc' }, { effective_date: 'desc' }, { id: 'desc' }],
      select: { category: true },
    }),
  ])
  const category = classification ? parseCatEchCode(classification.category).catNum : 0
  const endDate = workingEndDate(
    input.startDate,
    input.days,
    holidays,
    settings.saturdayWorking,
  )
  return {
    endDate,
    resumeDate: resumptionDate(endDate, category >= 9),
  }
}

export function formatSpanDate(value: Date): string {
  return dateOnly(value)
}

const DEATH_RELATION: Record<string, { noun: string; possessive: string }> = {
  DEATH_SPOUSE: { noun: 'spouse', possessive: "spouse's" },
  DEATH_CHILD: { noun: 'child', possessive: "child's" },
  DEATH_PARENT_IN_LAW: { noun: 'parent-in-law', possessive: "parent-in-law's" },
}

function parentFromReason(reason: string): { noun: string; possessive: string } {
  const mother = /\bmother\b/i.test(reason)
  const father = /\bfather\b/i.test(reason)
  if (mother && !father) return { noun: 'mother', possessive: "mother's" }
  if (father && !mother) return { noun: 'father', possessive: "father's" }
  return { noun: 'parent', possessive: "parent's" }
}

function isMarriageLeave(code: string | null, name: string | null): boolean {
  if (code === 'MARRIAGE_CHILD') return true
  const normalized = name?.trim().toLowerCase().replace(/\s+/g, ' ') ?? ''
  return normalized === 'marriage leave' || normalized === 'marriage of child'
}

function permissionLetter(input: {
  code: string | null
  name: string | null
  days: number
  word: string
  padded: string
  applied: string
  start: string
  end: string
  resume: string
  reason: string
}): { title: string; paragraphs: string[] } {
  const one = input.days === 1
  const count = one ? `one (${input.padded}) day` : `${input.word} (${input.padded}) days`
  const span = one ? `on the ${input.start}` : `from the ${input.start} to the ${input.end}`
  const death =
    input.code === 'DEATH_PARENT'
      ? parentFromReason(input.reason)
      : input.code
        ? DEATH_RELATION[input.code]
        : undefined
  if (death) {
    return {
      title: 'COMPASSIONATE LEAVE',
      paragraphs: [
        `The reference is your letter dated ${input.applied} requesting for ${count} permission following the death of your ${death.noun}.`,
        `Following the presentation of your late ${death.possessive} death certificate, we write to confirm the ${count} paid permission granted you ${span} as compassionate leave.`,
        `You are expected to resume duty on the ${input.resume}.`,
        'Accept our sympathy.',
      ],
    }
  }
  if (input.code === 'BIRTH_CHILD') {
    return {
      title: 'PATERNAL LEAVE',
      paragraphs: [
        `Reference is your letter dated ${input.applied} requesting for Paternity Leave.`,
        `Following the presentation of your child's Delivery Registration Certificate, we write to inform you that you have been granted ${count} paid permission (paternal leave) ${span} and will resume duty on the ${input.resume}.`,
        'Congratulations.',
      ],
    }
  }
  if (isMarriageLeave(input.code, input.name)) {
    return {
      title: 'SPECIAL PAID PERMISSION',
      paragraphs: [
        `Reference is your letter dated ${input.applied} on the above subject in which you attached a copy of your Marriage Certificate.`,
        `I write to confirm the ${count} Marriage leave granted you ${span}.`,
        `While it is hoped that you will resume duty on the ${input.resume}, please take note that the ${count} marriage leave granted you will be paid.`,
        'Congratulations.',
      ],
    }
  }
  const first = one
    ? `The reference is your letter dated ${input.applied} on the above subject and write to inform you that your request has been granted on the ${input.start} to enable you ${input.reason}.`
    : `I refer to your letter dated ${input.applied} on the above subject and write to confirm the ${capitalise(input.word)} (${input.padded}) days permission granted you from the ${input.start} to the ${input.end} to enable you ${input.reason}.`
  const second = one
    ? `While it is hoped that you will resume duty on the ${input.resume}. Please take note that the one (01) day permission granted you will count against your next leave when due.`
    : `While it is hoped that you will resume duty on the ${input.resume}, please take note that the ${input.word} (${input.padded}) days permission granted you will count against your next leave when due.`
  return { title: 'PERMISSION', paragraphs: [first, second] }
}

export async function buildPermissionMemo(request: {
  matricule: string
  days: number
  applicationDate: Date
  startDate: Date
  endDate: Date | null
  resumeDate: Date | null
  reason: string | null
  leaveTypeCode: string | null
  leaveTypeName: string | null
}): Promise<{ html: string; title: string }> {
  const [employee, classification, movement, employment, settings] = await Promise.all([
    prisma.tbl_employee.findUnique({
      where: { matricule: request.matricule },
      select: { name: true, firstname: true, sex: true, currentUnitId: true },
    }),
    prisma.tbl_emp_class.findFirst({
      where: { matricule: request.matricule, workflowStatus: 'VALIDATED' },
      orderBy: [{ letter_date: 'desc' }, { effective_date: 'desc' }, { id: 'desc' }],
      select: { category: true },
    }),
    prisma.tbl_emp_movement.findFirst({
      where: { matricule: request.matricule, workflowStatus: 'VALIDATED' },
      orderBy: [{ Eff_date: 'desc' }, { id: 'desc' }],
      select: { Position: true },
    }),
    prisma.tbl_emp_employment.findFirst({
      where: {
        matricule: request.matricule,
        current: true,
        workflowStatus: 'VALIDATED',
      },
      select: { jobEng: true },
    }),
    prisma.tbl_leave_letter_setting.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    }),
  ])
  if (!employee) {
    throw new PersonnelNotFoundError('Employee not found')
  }
  const category = classification ? parseCatEchCode(classification.category).catNum : 0
  const memoRef = leaveMemoFileRef('PERMISSION', category)
  if (!memoRef) {
    throw new PersonnelWorkflowError(
      'No file reference is defined for this employee category',
      400,
    )
  }
  const placement = await (async () => {
    if (!employee.currentUnitId) {
      return { unitId: null, unitName: null, groupId: null, sectionId: null }
    }
    const [unit, section] = await Promise.all([
      prisma.tbl_unit.findUnique({
        where: { id: employee.currentUnitId },
        select: { unit_name: true, groupid: true },
      }),
      prisma.tbl_section.findFirst({
        where: { tbl_unit_id: employee.currentUnitId },
        orderBy: { id: 'asc' },
        select: { id: true },
      }),
    ])
    return {
      unitId: employee.currentUnitId,
      unitName: unit?.unit_name ?? null,
      groupId: unit?.groupid ?? null,
      sectionId: section?.id ?? null,
    }
  })()
  const asOf = todayUtc()
  const signer = await resolveOfficialMemoSignatory({
    code: 'PERMISSION',
    category,
    unitId: placement.unitId,
    groupId: placement.groupId,
    asOf,
  })
  const throTitle = await resolveMemoThroTitle({
    unitId: placement.unitId,
    sectionId: placement.sectionId,
    signatoryTitle: signer?.title ?? null,
    asOf,
  })
  const span =
    request.endDate && request.resumeDate
      ? { endDate: request.endDate, resumeDate: request.resumeDate }
      : await resolvePermissionSpan({
          matricule: request.matricule,
          days: request.days,
          startDate: request.startDate,
        })
  const endDate = span.endDate
  const resumeDate = span.resumeDate
  const fullName = [employee.firstname, employee.name].filter(Boolean).join(' ')
  const employeeName =
    employee.sex === 'Female'
      ? `Mme. ${fullName}`
      : employee.sex === 'Male'
        ? `Mr. ${fullName}`
        : fullName
  const designation = movement?.Position?.trim() || employment?.jobEng?.trim() || null
  const reason = request.reason?.trim() || 'handle some personal issues'
  const word = daysWord(request.days)
  const padded = padDays(request.days)
  const letter = permissionLetter({
    code: request.leaveTypeCode,
    name: request.leaveTypeName,
    days: request.days,
    word,
    padded,
    applied: slashDate(request.applicationDate),
    start: slashDate(request.startDate),
    end: slashDate(endDate),
    resume: slashDate(resumeDate),
    reason,
  })
  const ccLines = (category >= 9 ? settings.ccCategory9 : settings.ccBelow)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const ccLayout: MemoCcLayout = settings.ccLayout === 'ROW' ? 'ROW' : 'COLUMN'
  const body = letter.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')
  const page = memoFormPageHtml({
    fromTitle: signer?.title ?? '',
    toName: employeeName,
    designation,
    throTitle,
    refs: [memoRef],
    matricule: request.matricule,
    dateHtml: memoDateHtml(asOf),
    subject: letter.title,
    bodyHtml: body,
    signatoryName: signer?.name ?? null,
    signatoryTitle: signer?.title ?? null,
    ccLines,
    ccLayout,
  })
  const html = memoFormDocumentHtml({ title: letter.title, pageHtml: page })
  return { html, title: letter.title }
}
