import bcrypt from 'bcryptjs'
import type { User } from '@personel-management-app/shared'
import { prisma } from '../db.js'
import { mapDbUser } from './user-mapper.js'

const BCRYPT_ROUNDS = 12
const BCRYPT_PREFIX = /^\$2[aby]\$/

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthValidationError'
  }
}

function isBcryptHash(value: string): boolean {
  return BCRYPT_PREFIX.test(value)
}

async function passwordsMatch(
  stored: string,
  candidate: string,
): Promise<{ valid: boolean; upgradedHash?: string }> {
  if (isBcryptHash(stored)) {
    return { valid: await bcrypt.compare(candidate, stored) }
  }
  if (stored === candidate) {
    return {
      valid: true,
      upgradedHash: await bcrypt.hash(candidate, BCRYPT_ROUNDS),
    }
  }
  return { valid: false }
}

/**
 * Validates credentials against tbl_users and returns the user without the
 * password field, or null when the credentials don't match.
 *
 * Legacy plaintext passwords are accepted once, then upgraded to a bcrypt hash
 * on successful login so the database migrates itself.
 */
export async function verifyLogin(
  username: string,
  password: string,
): Promise<User | null> {
  const user = await prisma.tbl_users.findFirst({
    where: { username },
  })

  if (!user?.password) {
    return null
  }

  const match = await passwordsMatch(user.password, password)
  if (!match.valid) {
    return null
  }

  if (match.upgradedHash) {
    await prisma.tbl_users.update({
      where: { id: user.id },
      data: { password: match.upgradedHash },
    })
  }

  return mapDbUser(user)
}

export async function changePassword(input: {
  username: string
  currentPassword: string
  newPassword: string
}): Promise<User> {
  if (input.newPassword === input.currentPassword) {
    throw new AuthValidationError(
      'New password must be different from the current password',
    )
  }

  const user = await prisma.tbl_users.findFirst({
    where: { username: input.username },
  })

  if (!user?.password) {
    throw new AuthValidationError('Invalid username or password')
  }

  const match = await passwordsMatch(user.password, input.currentPassword)
  if (!match.valid) {
    throw new AuthValidationError('Invalid username or password')
  }

  const hashed = await hashPassword(input.newPassword)
  const updated = await prisma.tbl_users.update({
    where: { id: user.id },
    data: {
      password: hashed,
      mustChangePassword: false,
    },
  })

  return mapDbUser(updated)
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}
