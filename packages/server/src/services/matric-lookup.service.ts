import type {
  AppraisalDateSnapshot,
  AppraisalDetail,
  AwardOption,
  MatricLookupMode,
  MatricLookupResult,
} from '@personel-management-app/shared'
import {
  computeServiceYears,
  formatLengthOfService,
  resolveAwardEligibilityScenario,
  resolveDatePrefill,
  resolveEligibleAwardIds,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { resolveLiveEmployee } from './live-employee.service.js'

export class PersonnelNotFoundError extends Error {
  constructor(matric: string) {
    super(
      `No personnel record found for Matric: ${matric}. Please initialize as new personnel.`,
    )
    this.name = 'PersonnelNotFoundError'
  }
}

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value) return null
  const y = value.getFullYear()
  const m = String(value.getMonth() + 1).padStart(2, '0')
  const d = String(value.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function ageFrom(dateOfBirth: Date | null | undefined): number | null {
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = today.getMonth() - dateOfBirth.getMonth()
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1
  }
  return age
}

type AppraisalRowWithAward = {
  id: number
  appyear: number | null
  matric: string | null
  date_lmerit: Date | null
  date_lstat: Date | null
  date_lpro: Date | null
  lengthservice: string | null
  pre_cat: string | null
  pro_cat: string | null
  tbl_award_id: number | null
  awardName: string | null
}

async function loadAwards(): Promise<AwardOption[]> {
  const rows = await prisma.tbl_award.findMany({ orderBy: { id: 'asc' } })
  return rows.map((r) => ({ id: r.id, award: r.award }))
}

async function getAppraisalForYear(
  matric: string,
  appyear: number,
): Promise<AppraisalRowWithAward | null> {
  const row = await prisma.tbl_perfappraisal.findFirst({
    where: { matric, appyear },
  })
  if (!row) return null

  let awardName: string | null = null
  if (row.tbl_award_id != null) {
    const award = await prisma.tbl_award.findUnique({
      where: { id: row.tbl_award_id },
      select: { award: true },
    })
    awardName = award?.award ?? null
  }

  return { ...row, awardName }
}

function toDateSnapshot(row: AppraisalRowWithAward): AppraisalDateSnapshot {
  return {
    dateLmerit: toDateOnly(row.date_lmerit),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardName: row.awardName,
  }
}

async function getSalaryReviewSnapshot(
  matric: string,
  appyear: number,
): Promise<AppraisalDateSnapshot | null> {
  const row = await prisma.tbl_salaryreview.findFirst({
    where: { matric, appyear },
    orderBy: { id: 'desc' },
  })
  if (!row) return null
  return {
    dateLmerit: toDateOnly(row.date_lmer),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardName: row.award ?? null,
  }
}

async function getPriorYearSnapshot(
  matric: string,
  appyear: number,
): Promise<AppraisalDateSnapshot | null> {
  const priorAppraisal = await getAppraisalForYear(matric, appyear - 1)
  if (priorAppraisal) return toDateSnapshot(priorAppraisal)
  return getSalaryReviewSnapshot(matric, appyear - 1)
}

function appraisalToDetail(
  row: AppraisalRowWithAward,
  names: string | null,
  employee: AppraisalDetail['employee'],
): AppraisalDetail {
  return {
    id: row.id,
    appyear: row.appyear,
    matric: row.matric ?? '',
    names,
    preCat: row.pre_cat,
    proCat: row.pro_cat,
    dateLmerit: toDateOnly(row.date_lmerit),
    dateLstat: toDateOnly(row.date_lstat),
    dateLpro: toDateOnly(row.date_lpro),
    awardId: row.tbl_award_id,
    lengthservice: row.lengthservice,
    employee: {
      ...employee,
      lengthService: row.lengthservice ?? employee.lengthService,
    },
  }
}

function liveEmployeeDetails(
  live: {
    unitName: string | null
    designation: string | null
    dateEng: Date | null
    dateBirth: Date
  },
  appyear: number,
): AppraisalDetail['employee'] {
  const serviceYears = computeServiceYears(live.dateEng, appyear)
  return {
    section: live.unitName,
    designation: live.designation,
    dateEngaged: toDateOnly(live.dateEng),
    dateOfBirth: toDateOnly(live.dateBirth),
    presentAge: ageFrom(live.dateBirth),
    lengthService: formatLengthOfService(serviceYears),
  }
}

export async function resolveMatricLookup(
  matric: string,
  appyear: number,
  mode: MatricLookupMode = 'create',
): Promise<MatricLookupResult> {
  const trimmed = matric.trim()
  const live = await resolveLiveEmployee(trimmed)

  if (!live) {
    throw new PersonnelNotFoundError(trimmed)
  }

  const [awards, currentYearAppraisal] = await Promise.all([
    loadAwards(),
    getAppraisalForYear(trimmed, appyear),
  ])

  const names = live.names
  const employee = liveEmployeeDetails(live, appyear)

  if (currentYearAppraisal) {
    const detail = appraisalToDetail(currentYearAppraisal, names, employee)
    const priorSnapshot = await getPriorYearSnapshot(trimmed, appyear)
    const scenario = resolveAwardEligibilityScenario({
      serviceYears: computeServiceYears(live.dateEng, appyear),
      priorYearAppraisal: priorSnapshot,
      currentYearAppraisal: toDateSnapshot(currentYearAppraisal),
    })
    return {
      ...detail,
      eligibleAwardIds: resolveEligibleAwardIds(awards, scenario),
    }
  }

  if (mode === 'edit') {
    const emptyDetail: AppraisalDetail = {
      id: null,
      appyear,
      matric: trimmed,
      names,
      preCat: null,
      proCat: null,
      dateLmerit: null,
      dateLstat: null,
      dateLpro: null,
      awardId: null,
      lengthservice: employee.lengthService,
      employee,
    }
    return {
      ...emptyDetail,
      eligibleAwardIds: resolveEligibleAwardIds(awards, 'no_history'),
    }
  }

  const serviceYears = computeServiceYears(live.dateEng, appyear)
  const priorSnapshot = await getPriorYearSnapshot(trimmed, appyear)

  const scenario = resolveAwardEligibilityScenario({
    serviceYears,
    priorYearAppraisal: priorSnapshot,
    currentYearAppraisal: null,
  })

  const dates = resolveDatePrefill({
    scenario,
    appyear,
    source: priorSnapshot,
  })

  const lengthservice = employee.lengthService

  return {
    id: null,
    appyear,
    matric: trimmed,
    names,
    preCat: live.preCat,
    proCat: null,
    dateLmerit: dates.dateLmerit,
    dateLstat: dates.dateLstat,
    dateLpro: dates.dateLpro,
    awardId: null,
    lengthservice,
    employee,
    eligibleAwardIds: resolveEligibleAwardIds(awards, scenario),
  }
}
