import type { User, UserUpsertInput } from '@perf-appraisal-app/shared'
import { Prisma } from '@prisma/client'
import { prisma } from '../db.js'
import {
  assertUserAssignmentInScope,
  assertUserRecordInScope,
  ForbiddenError,
  isUserRecordInScope,
} from './authz.service.js'
import { hashPassword } from './auth.service.js'
import {
  getScopeKindForRole,
  RoleNotFoundError,
} from './roles.service.js'
import { mapDbUser } from './user-mapper.js'

export class UserConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserConflictError'
  }
}

export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message)
    this.name = 'UserNotFoundError'
  }
}

export class UserValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserValidationError'
  }
}

async function scopeColumns(input: UserUpsertInput) {
  let scopeKind
  try {
    scopeKind = await getScopeKindForRole(input.role)
  } catch (err) {
    if (err instanceof RoleNotFoundError) {
      throw new UserValidationError(`Unknown role: ${input.role}`)
    }
    throw err
  }
  if (scopeKind === 'all') {
    return {
      tbl_group_id: null as string | null,
      tbl_zone_id: null as string | null,
      tbl_unit_id: null as string | null,
      tbl_section_id: null as number | null,
    }
  }
  if (scopeKind === 'group') {
    if (!input.groupId) {
      throw new UserValidationError('Group is required for this role')
    }
    return {
      tbl_group_id: input.groupId,
      tbl_zone_id: null,
      tbl_unit_id: null,
      tbl_section_id: null,
    }
  }
  if (scopeKind === 'zone') {
    if (!input.zoneId) {
      throw new UserValidationError('Zone is required for this role')
    }
    return {
      tbl_group_id: null,
      tbl_zone_id: input.zoneId,
      tbl_unit_id: null,
      tbl_section_id: null,
    }
  }
  if (scopeKind === 'unit') {
    if (!input.unitId) {
      throw new UserValidationError('Unit is required for this role')
    }
    return {
      tbl_group_id: null,
      tbl_zone_id: null,
      tbl_unit_id: input.unitId,
      tbl_section_id: null,
    }
  }
  if (input.sectionId == null) {
    throw new UserValidationError('Section is required for this role')
  }
  return {
    tbl_group_id: null,
    tbl_zone_id: null,
    tbl_unit_id: null,
    tbl_section_id: input.sectionId,
  }
}

export async function listUsers(actor: User): Promise<User[]> {
  const rows = await prisma.tbl_users.findMany({
    orderBy: { id: 'asc' },
  })
  const users = await Promise.all(rows.map((row) => mapDbUser(row)))
  const kept: User[] = []
  for (const user of users) {
    if (user.id === actor.id) continue
    if (await isUserRecordInScope(actor, user)) {
      kept.push(user)
    }
  }
  return kept
}

export async function createUser(
  actor: User,
  input: UserUpsertInput,
): Promise<User> {
  if (!input.password) {
    throw new UserValidationError('Password is required')
  }
  const scope = await scopeColumns(input)
  await assertUserAssignmentInScope(actor, {
    role: input.role,
    groupId: scope.tbl_group_id,
    zoneId: scope.tbl_zone_id,
    unitId: scope.tbl_unit_id,
    sectionId: scope.tbl_section_id,
  })

  const password = await hashPassword(input.password)
  try {
    const row = await prisma.tbl_users.create({
      data: {
        username: input.username.trim(),
        password,
        role: input.role,
        mustChangePassword: true,
        ...scope,
      },
    })
    return mapDbUser(row)
  } catch (err) {
    if (err instanceof ForbiddenError) throw err
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new UserConflictError('Username already exists')
    }
    throw err
  }
}

export async function updateUser(
  actor: User,
  id: number,
  input: UserUpsertInput,
): Promise<User> {
  if (id === actor.id) {
    throw new ForbiddenError('You cannot edit your own account here')
  }

  const existing = await prisma.tbl_users.findUnique({ where: { id } })
  if (!existing) {
    throw new UserNotFoundError()
  }

  const existingUser = await mapDbUser(existing)
  await assertUserRecordInScope(actor, existingUser)

  const scope = await scopeColumns(input)
  await assertUserAssignmentInScope(actor, {
    role: input.role,
    groupId: scope.tbl_group_id,
    zoneId: scope.tbl_zone_id,
    unitId: scope.tbl_unit_id,
    sectionId: scope.tbl_section_id,
  })

  const data: Prisma.tbl_usersUpdateInput = {
    username: input.username.trim(),
    role: input.role,
    ...scope,
  }
  if (input.password) {
    data.password = await hashPassword(input.password)
    data.mustChangePassword = true
  }

  try {
    const row = await prisma.tbl_users.update({
      where: { id },
      data,
    })
    return mapDbUser(row)
  } catch (err) {
    if (err instanceof ForbiddenError) throw err
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new UserConflictError('Username already exists')
    }
    throw err
  }
}

export async function deleteUser(actor: User, id: number): Promise<void> {
  const existing = await prisma.tbl_users.findUnique({ where: { id } })
  if (!existing) {
    throw new UserNotFoundError()
  }

  const existingUser = await mapDbUser(existing)
  await assertUserRecordInScope(actor, existingUser)

  try {
    await prisma.tbl_users.delete({ where: { id } })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw new UserNotFoundError()
    }
    throw err
  }
}
