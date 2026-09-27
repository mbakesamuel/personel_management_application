import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  ChangePasswordRequestSchema,
  LoginRequestSchema,
} from '@personel-management-app/shared'
import {
  AuthValidationError,
  changePassword,
  verifyLogin,
} from '../services/auth.service.js'
import { resolveUserFinancialYear } from '../services/financialyear.service.js'

const auth = new Hono()
  .post('/login', zValidator('json', LoginRequestSchema), async (c) => {
    const { username, password } = c.req.valid('json')

    const user = await verifyLogin(username, password)
    if (!user) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    const financialYear = await resolveUserFinancialYear(user.id)
    return c.json({ user, financialYear })
  })
  .post(
    '/change-password',
    zValidator('json', ChangePasswordRequestSchema),
    async (c) => {
      try {
        const input = c.req.valid('json')
        const user = await changePassword(input)
        const financialYear = await resolveUserFinancialYear(user.id)
        return c.json({ user, financialYear })
      } catch (err) {
        if (err instanceof AuthValidationError) {
          const status = err.message.startsWith('Invalid') ? 401 : 400
          return c.json({ error: err.message }, status)
        }
        throw err
      }
    },
  )

export { auth }
