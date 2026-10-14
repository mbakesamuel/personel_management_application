import {
  buildServicePosts,
  SERVICE_LETTER_FILE_REF,
  serviceCertificateDuties,
  type ServiceLetter,
  type ServiceLetterKind,
  type ServiceMovement,
} from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { formatEmployeeName, unitMatchIds } from './live-employee.service.js'
import {
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from './personnel-workflow.js'

function toDateOnly(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null
  const iso = value.toISOString().slice(0, 10)
  if (iso.startsWith('0000') || iso < '1900-01-01') return null
  return iso
}

function courtesyAndPronoun(sex: string | null): {
  courtesy: string
  pronoun: string
} {
  if (sex === 'Male') return { courtesy: 'Mr.', pronoun: 'He' }
  if (sex === 'Female') return { courtesy: 'Mme.', pronoun: 'She' }
  return { courtesy: '', pronoun: 'They' }
}

export async function getServiceLetter(
  matricule: string,
  kind: ServiceLetterKind,
): Promise<ServiceLetter> {
  const employee = await prisma.tbl_employee.findUnique({
    where: { matricule },
    select: {
      matricule: true,
      name: true,
      firstname: true,
      sex: true,
      currentUnitId: true,
    },
  })
  if (!employee) throw new PersonnelNotFoundError('Employee not found')

  const employment = await prisma.tbl_emp_employment.findFirst({
    where: {
      matricule,
      workflowStatus: 'VALIDATED',
      current: true,
    },
    orderBy: { dateEng: 'desc' },
    select: { dateEng: true, jobEng: true, placeEng: true },
  })
  const fallbackEmployment =
    employment ??
    (await prisma.tbl_emp_employment.findFirst({
      where: { matricule, workflowStatus: 'VALIDATED' },
      orderBy: { dateEng: 'desc' },
      select: { dateEng: true, jobEng: true, placeEng: true },
    }))
  const engagementDate = toDateOnly(fallbackEmployment?.dateEng)
  if (!fallbackEmployment || !engagementDate) {
    throw new PersonnelWorkflowError(
      'This employee has no validated engagement date',
    )
  }

  const [movementRows, departure, currentUnit] = await Promise.all([
    prisma.tbl_emp_movement.findMany({
      where: { matricule, workflowStatus: 'VALIDATED' },
      orderBy: [{ Eff_date: 'asc' }, { id: 'asc' }],
      select: {
        Eff_date: true,
        Position: true,
        To_unit: {
          select: {
            unit_name: true,
            zone: { select: { zone_name: true } },
          },
        },
      },
    }),
    prisma.tbl_emp_departure.findFirst({
      where: { matricule, workflowStatus: 'VALIDATED' },
      orderBy: [{ current: 'desc' }, { effectiveDate: 'desc' }],
      select: { effectiveDate: true },
    }),
    employee.currentUnitId
      ? prisma.tbl_unit.findFirst({
          where: { id: { in: unitMatchIds([employee.currentUnitId]) } },
          select: {
            unit_name: true,
            zone: { select: { zone_name: true } },
          },
        })
      : Promise.resolve(null),
  ])

  const movements: ServiceMovement[] = []
  for (const row of movementRows) {
    const date = toDateOnly(row.Eff_date)
    if (!date) continue
    movements.push({
      date,
      position: row.Position?.trim() ?? '',
      location: row.To_unit?.unit_name?.trim() ?? '',
    })
  }

  const endDate =
    kind === 'certificate' ? toDateOnly(departure?.effectiveDate) : null
  const posts = buildServicePosts({
    engagementDate,
    job: fallbackEmployment.jobEng,
    place: fallbackEmployment.placeEng,
    movements,
    endDate,
  })
  const currentPost = posts[posts.length - 1]

  let unitName = currentUnit?.unit_name?.trim() || null
  let zoneName = currentUnit?.zone.zone_name?.trim() || null
  if (!unitName) {
    const latestUnit = [...movementRows]
      .reverse()
      .find((row) => row.To_unit?.unit_name?.trim())
    unitName = latestUnit?.To_unit?.unit_name?.trim() || null
    zoneName = latestUnit?.To_unit?.zone.zone_name?.trim() || null
  }
  if (!unitName && fallbackEmployment.placeEng.trim()) {
    unitName = fallbackEmployment.placeEng.trim()
    zoneName = null
  }

  const { courtesy, pronoun } = courtesyAndPronoun(employee.sex)
  const fullName = formatEmployeeName(employee.name, employee.firstname)

  return {
    kind,
    fileRef: SERVICE_LETTER_FILE_REF,
    matricule: employee.matricule,
    fullName,
    courtesy,
    pronoun,
    engagementDate,
    currentPosition: currentPost?.position ?? fallbackEmployment.jobEng.trim(),
    unitName,
    zoneName,
    endDate,
    posts,
    duties:
      kind === 'certificate'
        ? serviceCertificateDuties({ courtesy, fullName, posts })
        : '',
  }
}
