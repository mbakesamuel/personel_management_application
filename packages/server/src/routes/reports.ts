import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  AllocationLetterListQuerySchema,
  AppraisalListQuerySchema,
} from '@personel-management-app/shared'
import type { AppVariables } from '../middleware/current-user.js'
import {
  ForbiddenError,
  requirePermission,
  sectionIdsForUser,
} from '../services/authz.service.js'
import { buildAllocationLetters } from '../services/allocation-letters.service.js'
import { buildAppraisalLetters } from '../services/letters.service.js'
import { listSalaryReviewYears } from '../services/salary-review-export.service.js'
import { buildAppraisalSummary } from '../services/summary.service.js'

const reports = new Hono<{ Variables: AppVariables }>()
  .get('/appraisal-letter-years', async (c) => {
    const user = c.get('currentUser')
    try {
      await requirePermission(user, 'canAppraisals')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }

    const scopeSectionIds = await sectionIdsForUser(user)
    return c.json({ years: await listSalaryReviewYears(scopeSectionIds) })
  })
  .get(
    '/appraisal-letters',
    zValidator('query', AppraisalListQuerySchema),
    async (c) => {
      const user = c.get('currentUser')
      try {
        await requirePermission(user, 'canAppraisals')
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }

      const query = c.req.valid('query')
      const scopeSectionIds = await sectionIdsForUser(user)
      const data = await buildAppraisalLetters(query, scopeSectionIds)
      return c.json(data)
    },
  )
  .get(
    '/appraisal-summary',
    zValidator('query', AppraisalListQuerySchema),
    async (c) => {
      const user = c.get('currentUser')
      try {
        await requirePermission(user, 'canAppraisals')
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }

      const query = c.req.valid('query')
      const scopeSectionIds = await sectionIdsForUser(user)
      const data = await buildAppraisalSummary(query, scopeSectionIds)
      return c.json(data)
    },
  )
  .get(
    '/allowance-allocation-letters',
    zValidator('query', AllocationLetterListQuerySchema),
    async (c) => {
      const user = c.get('currentUser')
      try {
        await requirePermission(user, 'canAllowances')
        await requirePermission(user, 'canAllowanceAllocations')
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }

      const query = c.req.valid('query')
      const scopeSectionIds = await sectionIdsForUser(user)
      const data = await buildAllocationLetters(query, scopeSectionIds)
      return c.json(data)
    },
  )

export { reports }
