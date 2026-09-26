import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  AppraisalListQuerySchema,
  AppraisalUpsertSchema,
  MatricLookupQuerySchema,
  PostSalaryReviewBatchSchema,
  PostSalaryReviewStartSchema,
  ProposeCategorySchema,
  SalaryReviewExportQuerySchema,
  SalaryReviewImportBatchSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  deleteAppraisal,
  getAppraisalDetail,
  listAppraisals,
  listAwards,
  listSections,
  listUnits,
  lookupEmployeeByMatric,
  upsertAppraisal,
} from '../services/appraisal.service.js'
import {
  assertEmployeeInScope,
  ForbiddenError,
  requirePermission,
  sectionIdsForUser,
  unitIdsForUser,
} from '../services/authz.service.js'
import {
  assertFinancialYearOpen,
  FinancialYearClosedError,
  FinancialYearNotFoundError,
} from '../services/financialyear.service.js'
import { PersonnelNotFoundError } from '../services/matric-lookup.service.js'
import {
  CategoryParseError,
  proposeCategory,
} from '../services/category-proposal.service.js'
import {
  postSalaryReviewBatch,
  startSalaryReviewPost,
} from '../services/salary-review.service.js'
import { importSalaryReviewBatch } from '../services/salary-review-import.service.js'
import {
  exportSalaryReview,
  listSalaryReviewYears,
} from '../services/salary-review-export.service.js'

function mapFinancialYearError(err: unknown) {
  if (err instanceof FinancialYearNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof FinancialYearClosedError) {
    return { status: 409 as const, message: err.message }
  }
  return null
}

const appraisals = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canAppraisals')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', zValidator('query', AppraisalListQuerySchema), async (c) => {
    const user = c.get('currentUser')
    const query = c.req.valid('query')
    const scopeSectionIds = await sectionIdsForUser(user)
    const data = await listAppraisals(query, scopeSectionIds)
    return c.json(data)
  })
  .get('/awards', async (c) => c.json(await listAwards()))
  .get('/units', async (c) => {
    const user = c.get('currentUser')
    const units = await listUnits()
    const allowed = await unitIdsForUser(user)
    if (allowed === null) return c.json(units)
    return c.json(units.filter((u) => allowed.includes(u.id)))
  })
  .get(
    '/sections',
    zValidator(
      'query',
      z.object({ unitId: z.string().min(1).max(3).optional() }),
    ),
    async (c) => {
      const user = c.get('currentUser')
      const { unitId } = c.req.valid('query')
      const sections = await listSections(unitId)
      const allowed = await sectionIdsForUser(user)
      if (allowed === null) return c.json(sections)
      return c.json(sections.filter((s) => allowed.includes(s.id)))
    },
  )
  .get(
    '/lookup',
    zValidator('query', MatricLookupQuerySchema),
    async (c) => {
      const user = c.get('currentUser')
      const { matric, appyear, mode } = c.req.valid('query')
      try {
        await assertEmployeeInScope(user, matric)
        if (mode === 'create') {
          await assertFinancialYearOpen(appyear)
        }
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        const fyErr = mapFinancialYearError(err)
        if (fyErr) return c.json({ error: fyErr.message }, fyErr.status)
        throw err
      }
      try {
        return c.json(await lookupEmployeeByMatric(matric, appyear, mode))
      } catch (err) {
        if (err instanceof PersonnelNotFoundError) {
          return c.json({ error: err.message }, 404)
        }
        throw err
      }
    },
  )
  .post(
    '/propose-category',
    zValidator('json', ProposeCategorySchema),
    async (c) => {
      const body = c.req.valid('json')
      try {
        return c.json(await proposeCategory(body.preCat, body.awardId))
      } catch (err) {
        if (err instanceof CategoryParseError) {
          return c.json({ error: err.message }, 400)
        }
        throw err
      }
    },
  )
  .post(
    '/post-salary-review/start',
    zValidator('json', PostSalaryReviewStartSchema),
    async (c) => {
      const { appyear } = c.req.valid('json')
      try {
        await assertFinancialYearOpen(appyear)
        return c.json(await startSalaryReviewPost(appyear))
      } catch (err) {
        const fyErr = mapFinancialYearError(err)
        if (fyErr) return c.json({ error: fyErr.message }, fyErr.status)
        throw err
      }
    },
  )
  .post(
    '/post-salary-review/batch',
    zValidator('json', PostSalaryReviewBatchSchema),
    async (c) => {
      const { appyear, ids } = c.req.valid('json')
      try {
        await assertFinancialYearOpen(appyear)
        return c.json(await postSalaryReviewBatch(appyear, ids))
      } catch (err) {
        const fyErr = mapFinancialYearError(err)
        if (fyErr) return c.json({ error: fyErr.message }, fyErr.status)
        throw err
      }
    },
  )
  .post(
    '/salary-review/import',
    zValidator('json', SalaryReviewImportBatchSchema),
    async (c) => {
      try {
        await requirePermission(
          c.get('currentUser'),
          'canImportHistory',
          'You do not have permission to import historic appraisals',
        )
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }
      return c.json(await importSalaryReviewBatch(c.req.valid('json')))
    },
  )
  .get('/salary-review/years', async (c) => {
    try {
      await requirePermission(
        c.get('currentUser'),
        'canExportHistory',
        'You do not have permission to export historic appraisals',
      )
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    const scopeSectionIds = await sectionIdsForUser(c.get('currentUser'))
    return c.json({ years: await listSalaryReviewYears(scopeSectionIds) })
  })
  .get(
    '/salary-review/export',
    zValidator('query', SalaryReviewExportQuerySchema),
    async (c) => {
      try {
        await requirePermission(
          c.get('currentUser'),
          'canExportHistory',
          'You do not have permission to export historic appraisals',
        )
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }
      const query = c.req.valid('query')
      const scopeSectionIds = await sectionIdsForUser(c.get('currentUser'))
      return c.json(await exportSalaryReview(query, scopeSectionIds))
    },
  )
  .get(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      const user = c.get('currentUser')
      const { id } = c.req.valid('param')
      const detail = await getAppraisalDetail(id)
      if (!detail) {
        return c.json({ error: 'Appraisal not found' }, 404)
      }
      try {
        await assertEmployeeInScope(user, detail.matric)
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        throw err
      }
      return c.json(detail)
    },
  )
  .post('/', zValidator('json', AppraisalUpsertSchema), async (c) => {
    const user = c.get('currentUser')
    const body = c.req.valid('json')
    try {
      await assertEmployeeInScope(user, body.matric)
      await assertFinancialYearOpen(body.appyear)
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      const fyErr = mapFinancialYearError(err)
      if (fyErr) return c.json({ error: fyErr.message }, fyErr.status)
      throw err
    }
    const detail = await upsertAppraisal(body)
    return c.json(detail, 201)
  })
  .put(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    zValidator('json', AppraisalUpsertSchema),
    async (c) => {
      const user = c.get('currentUser')
      const { id } = c.req.valid('param')
      const body = c.req.valid('json')
      try {
        await assertEmployeeInScope(user, body.matric)
        const existing = await getAppraisalDetail(id)
        if (existing) {
          await assertEmployeeInScope(user, existing.matric)
          if (existing.appyear != null) {
            await assertFinancialYearOpen(existing.appyear)
          }
        }
        await assertFinancialYearOpen(body.appyear)
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        const fyErr = mapFinancialYearError(err)
        if (fyErr) return c.json({ error: fyErr.message }, fyErr.status)
        throw err
      }
      const detail = await upsertAppraisal({ ...body, id })
      return c.json(detail)
    },
  )
  .delete(
    '/:id',
    zValidator('param', z.object({ id: z.coerce.number().int() })),
    async (c) => {
      const user = c.get('currentUser')
      const { id } = c.req.valid('param')
      const existing = await getAppraisalDetail(id)
      if (!existing) {
        return c.json({ error: 'Appraisal not found' }, 404)
      }
      try {
        await assertEmployeeInScope(user, existing.matric)
        if (existing.appyear != null) {
          await assertFinancialYearOpen(existing.appyear)
        }
      } catch (err) {
        if (err instanceof ForbiddenError) {
          return c.json({ error: err.message }, 403)
        }
        const fyErr = mapFinancialYearError(err)
        if (fyErr) return c.json({ error: fyErr.message }, fyErr.status)
        throw err
      }
      await deleteAppraisal(id)
      return c.json({ ok: true })
    },
  )

export { appraisals }
