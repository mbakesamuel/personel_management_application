import type {
  GroupOption,
  GroupUpsertInput,
  SectionOption,
  SectionUpsertInput,
  UnitOption,
  UnitUpsertInput,
  ZoneOption,
  ZoneUpsertInput,
} from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export class OrgConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgConflictError'
  }
}

export class OrgNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgNotFoundError'
  }
}

function mapGroup(row: {
  id: string
  group_name: string
  active: boolean
}): GroupOption {
  return { id: row.id, groupName: row.group_name, active: row.active }
}

function mapZone(row: {
  id: string
  zone_name: string
  groupId: string
  active: boolean
}): ZoneOption {
  return {
    id: row.id,
    zoneName: row.zone_name,
    groupId: row.groupId,
    active: row.active,
  }
}

function mapUnit(row: {
  id: string
  unit_name: string
  groupid: string
  zoneId: string
  active: boolean
}): UnitOption {
  return {
    id: row.id,
    unitName: row.unit_name,
    groupId: row.groupid,
    zoneId: row.zoneId,
    active: row.active,
  }
}

function mapSection(row: {
  id: number
  section: string | null
  tbl_unit_id: string | null
  active: boolean
}): SectionOption {
  return {
    id: row.id,
    section: row.section,
    unitId: row.tbl_unit_id,
    active: row.active,
  }
}

export async function listGroups(): Promise<GroupOption[]> {
  const rows = await prisma.tbl_group.findMany({
    orderBy: { group_name: 'asc' },
    select: { id: true, group_name: true, active: true },
  })
  return rows.map(mapGroup)
}

export async function createGroup(input: GroupUpsertInput): Promise<GroupOption> {
  const now = new Date()
  try {
    const row = await prisma.tbl_group.create({
      data: {
        id: input.id,
        group_name: input.groupName,
        active: input.active,
        createdat: now,
        updatedat: now,
      },
      select: { id: true, group_name: true, active: true },
    })
    await prisma.tbl_zone.create({
      data: {
        id: `${row.id}-Z01`,
        zone_name: 'Default',
        groupId: row.id,
        active: true,
        createdat: now,
        updatedat: now,
      },
    })
    return mapGroup(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Group ${input.id} already exists`)
    }
    throw err
  }
}

export async function updateGroup(
  id: string,
  input: GroupUpsertInput,
): Promise<GroupOption> {
  try {
    const row = await prisma.tbl_group.update({
      where: { id },
      data: {
        id: input.id,
        group_name: input.groupName,
        active: input.active,
        updatedat: new Date(),
      },
      select: { id: true, group_name: true, active: true },
    })
    return mapGroup(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Group not found')
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Group ${input.id} already exists`)
    }
    throw err
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const zoneCount = await prisma.tbl_zone.count({ where: { groupId: id } })
  if (zoneCount > 0) {
    throw new OrgConflictError(
      `Cannot delete group ${id}: it is used by ${zoneCount} zone(s)`,
    )
  }
  const unitCount = await prisma.tbl_unit.count({ where: { groupid: id } })
  if (unitCount > 0) {
    throw new OrgConflictError(
      `Cannot delete group ${id}: it is used by ${unitCount} unit(s)`,
    )
  }
  try {
    await prisma.tbl_group.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Group not found')
    }
    throw err
  }
}

export async function listOrgZones(groupId?: string): Promise<ZoneOption[]> {
  const rows = await prisma.tbl_zone.findMany({
    where: groupId ? { groupId } : undefined,
    orderBy: { zone_name: 'asc' },
    select: { id: true, zone_name: true, groupId: true, active: true },
  })
  return rows.map(mapZone)
}

export async function createZone(input: ZoneUpsertInput): Promise<ZoneOption> {
  const group = await prisma.tbl_group.findUnique({
    where: { id: input.groupId },
    select: { id: true, active: true },
  })
  if (!group) {
    throw new OrgNotFoundError(`Group ${input.groupId} not found`)
  }
  if (!group.active) {
    throw new OrgConflictError(`Group ${input.groupId} is inactive`)
  }
  const now = new Date()
  try {
    const row = await prisma.tbl_zone.create({
      data: {
        id: input.id,
        zone_name: input.zoneName,
        groupId: input.groupId,
        active: input.active ?? true,
        createdat: now,
        updatedat: now,
      },
      select: { id: true, zone_name: true, groupId: true, active: true },
    })
    return mapZone(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Zone ${input.id} already exists`)
    }
    throw err
  }
}

export async function updateZone(
  id: string,
  input: ZoneUpsertInput,
): Promise<ZoneOption> {
  const group = await prisma.tbl_group.findUnique({
    where: { id: input.groupId },
    select: { id: true, active: true },
  })
  if (!group) {
    throw new OrgNotFoundError(`Group ${input.groupId} not found`)
  }
  const existing = await prisma.tbl_zone.findUnique({
    where: { id },
    select: { id: true, groupId: true },
  })
  if (!existing) {
    throw new OrgNotFoundError('Zone not found')
  }
  if (!group.active && existing.groupId !== input.groupId) {
    throw new OrgConflictError(`Group ${input.groupId} is inactive`)
  }
  try {
    const row = await prisma.tbl_zone.update({
      where: { id },
      data: {
        id: input.id,
        zone_name: input.zoneName,
        groupId: input.groupId,
        active: input.active ?? true,
        updatedat: new Date(),
      },
      select: { id: true, zone_name: true, groupId: true, active: true },
    })
    if (existing.groupId !== input.groupId || id !== input.id) {
      await prisma.tbl_unit.updateMany({
        where: { zoneId: row.id },
        data: { groupid: input.groupId },
      })
    }
    return mapZone(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Zone not found')
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Zone ${input.id} already exists`)
    }
    throw err
  }
}

export async function deleteZone(id: string): Promise<void> {
  const unitCount = await prisma.tbl_unit.count({ where: { zoneId: id } })
  if (unitCount > 0) {
    throw new OrgConflictError(
      `Cannot delete zone ${id}: it is used by ${unitCount} unit(s)`,
    )
  }
  try {
    await prisma.tbl_zone.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Zone not found')
    }
    throw err
  }
}

export async function listOrgUnits(): Promise<UnitOption[]> {
  const rows = await prisma.tbl_unit.findMany({
    orderBy: { unit_name: 'asc' },
    select: {
      id: true,
      unit_name: true,
      groupid: true,
      zoneId: true,
      active: true,
    },
  })
  return rows.map(mapUnit)
}

export async function createUnit(input: UnitUpsertInput): Promise<UnitOption> {
  const zone = await prisma.tbl_zone.findUnique({
    where: { id: input.zoneId },
    select: { id: true, groupId: true, active: true },
  })
  if (!zone) {
    throw new OrgNotFoundError(`Zone ${input.zoneId} not found`)
  }
  if (!zone.active) {
    throw new OrgConflictError(`Zone ${input.zoneId} is inactive`)
  }
  if (zone.groupId !== input.groupId) {
    throw new OrgConflictError(
      `Zone ${input.zoneId} does not belong to group ${input.groupId}`,
    )
  }
  const now = new Date()
  try {
    const row = await prisma.tbl_unit.create({
      data: {
        id: input.id,
        unit_name: input.unitName,
        groupid: zone.groupId,
        zoneId: zone.id,
        active: input.active ?? true,
        createdat: now,
        updatedat: now,
      },
      select: {
        id: true,
        unit_name: true,
        groupid: true,
        zoneId: true,
        active: true,
      },
    })
    return mapUnit(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Unit ${input.id} already exists`)
    }
    throw err
  }
}

export async function updateUnit(
  id: string,
  input: UnitUpsertInput,
): Promise<UnitOption> {
  const zone = await prisma.tbl_zone.findUnique({
    where: { id: input.zoneId },
    select: { id: true, groupId: true, active: true },
  })
  if (!zone) {
    throw new OrgNotFoundError(`Zone ${input.zoneId} not found`)
  }
  if (zone.groupId !== input.groupId) {
    throw new OrgConflictError(
      `Zone ${input.zoneId} does not belong to group ${input.groupId}`,
    )
  }
  const existing = await prisma.tbl_unit.findUnique({
    where: { id },
    select: { id: true, zoneId: true },
  })
  if (!existing) {
    throw new OrgNotFoundError('Unit not found')
  }
  if (!zone.active && existing.zoneId !== input.zoneId) {
    throw new OrgConflictError(`Zone ${input.zoneId} is inactive`)
  }
  try {
    const row = await prisma.tbl_unit.update({
      where: { id },
      data: {
        id: input.id,
        unit_name: input.unitName,
        groupid: zone.groupId,
        zoneId: zone.id,
        active: input.active ?? true,
        updatedat: new Date(),
      },
      select: {
        id: true,
        unit_name: true,
        groupid: true,
        zoneId: true,
        active: true,
      },
    })
    return mapUnit(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Unit not found')
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Unit ${input.id} already exists`)
    }
    throw err
  }
}

export async function deleteUnit(id: string): Promise<void> {
  const sectionCount = await prisma.tbl_section.count({
    where: { tbl_unit_id: id },
  })
  if (sectionCount > 0) {
    throw new OrgConflictError(
      `Cannot delete unit ${id}: it is used by ${sectionCount} section(s)`,
    )
  }
  try {
    await prisma.tbl_unit.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Unit not found')
    }
    throw err
  }
}

export async function listOrgSections(unitId?: string): Promise<SectionOption[]> {
  const rows = await prisma.tbl_section.findMany({
    where: unitId ? { tbl_unit_id: unitId } : undefined,
    orderBy: { section: 'asc' },
    select: {
      id: true,
      section: true,
      tbl_unit_id: true,
      active: true,
    },
  })
  return rows.map(mapSection)
}

export async function createSection(
  input: SectionUpsertInput,
): Promise<SectionOption> {
  if (input.unitId) {
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: input.unitId },
      select: { id: true, active: true },
    })
    if (!unit) {
      throw new OrgNotFoundError(`Unit ${input.unitId} not found`)
    }
    if (!unit.active) {
      throw new OrgConflictError(`Unit ${input.unitId} is inactive`)
    }
  }

  let id = input.id
  if (id == null) {
    const max = await prisma.tbl_section.aggregate({ _max: { id: true } })
    id = (max._max.id ?? 0) + 1
  }

  try {
    const row = await prisma.tbl_section.create({
      data: {
        id,
        section: input.section,
        tbl_unit_id: input.unitId,
        active: input.active,
      },
    })
    return mapSection(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new OrgConflictError(`Section ${id} already exists`)
    }
    throw err
  }
}

export async function updateSection(
  id: number,
  input: SectionUpsertInput,
): Promise<SectionOption> {
  const existing = await prisma.tbl_section.findUnique({
    where: { id },
    select: { id: true, tbl_unit_id: true },
  })
  if (!existing) {
    throw new OrgNotFoundError('Section not found')
  }
  if (input.unitId) {
    const unit = await prisma.tbl_unit.findUnique({
      where: { id: input.unitId },
      select: { id: true, active: true },
    })
    if (!unit) {
      throw new OrgNotFoundError(`Unit ${input.unitId} not found`)
    }
    if (!unit.active && existing.tbl_unit_id !== input.unitId) {
      throw new OrgConflictError(`Unit ${input.unitId} is inactive`)
    }
  }

  try {
    const row = await prisma.tbl_section.update({
      where: { id },
      data: {
        section: input.section,
        tbl_unit_id: input.unitId,
        active: input.active,
      },
      select: {
        id: true,
        section: true,
        tbl_unit_id: true,
        active: true,
      },
    })
    return mapSection(row)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Section not found')
    }
    throw err
  }
}

export async function deleteSection(id: number): Promise<void> {
  const salaryReviewCount = await prisma.tbl_salaryreview.count({
    where: { tbl_section_id: id },
  })
  if (salaryReviewCount > 0) {
    throw new OrgConflictError(
      `Cannot delete section ${id}: it is used by ${salaryReviewCount} salary review record(s)`,
    )
  }
  try {
    await prisma.tbl_section.delete({ where: { id } })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new OrgNotFoundError('Section not found')
    }
    throw err
  }
}
