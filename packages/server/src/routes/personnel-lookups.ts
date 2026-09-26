import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  absenceLookup,
  bankLookup,
  classificationLookup,
  diplomaLookup,
  divisionLookup,
  insuranceCentreLookup,
  languageLookup,
  maritalStatusLookup,
  nationalityLookup,
  regionLookup,
  religionLookup,
  sanctionLookup,
  sexLookup,
  transferTypeLookup,
  workerUnionLookup,
  workStatusLookup,
} from '../services/personnel-lookups.service.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from '../services/personnel-workflow.js'

const IdParam = z.object({ id: z.string().min(1) })
const RegionQuery = z.object({
  regionId: z.string().min(1).optional(),
})

function mapLookupError(err: unknown) {
  if (err instanceof PersonnelNotFoundError) {
    return { status: 404 as const, message: err.message }
  }
  if (err instanceof PersonnelConflictError) {
    return { status: 409 as const, message: err.message }
  }
  if (err instanceof PersonnelWorkflowError) {
    return { status: err.status, message: err.message }
  }
  if (err instanceof z.ZodError) {
    return {
      status: 400 as const,
      message: err.issues[0]?.message ?? 'Invalid request',
    }
  }
  return null
}

async function handle<T>(
  c: { json: (body: unknown, status?: number) => Response },
  fn: () => Promise<T>,
  successStatus: number = 200,
) {
  try {
    const result = await fn()
    return c.json(result as never, successStatus as never)
  } catch (err) {
    const mapped = mapLookupError(err)
    if (mapped) return c.json({ error: mapped.message }, mapped.status)
    throw err
  }
}

function lookupRouter<TCreate, TUpdate>(opts: {
  list: (query?: { regionId?: string }) => Promise<unknown>
  get: (id: string) => Promise<unknown>
  create: (data: TCreate) => Promise<unknown>
  update: (id: string, data: TUpdate) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
  createSchema: z.ZodType<TCreate>
  updateSchema: z.ZodType<TUpdate>
  listQuerySchema?: z.ZodType<{ regionId?: string }>
}) {
  const querySchema = opts.listQuerySchema ?? z.object({})

  return new Hono<{ Variables: AppVariables }>()
    .get('/', zValidator('query', querySchema), async (c) =>
      handle(c, () => opts.list(c.req.valid('query'))),
    )
    .post('/', zValidator('json', opts.createSchema), async (c) =>
      handle(c, () => opts.create(c.req.valid('json')), 201),
    )
    .get('/:id', zValidator('param', IdParam), async (c) =>
      handle(c, () => opts.get(c.req.valid('param').id)),
    )
    .patch(
      '/:id',
      zValidator('param', IdParam),
      zValidator('json', opts.updateSchema),
      async (c) =>
        handle(c, () =>
          opts.update(c.req.valid('param').id, c.req.valid('json')),
        ),
    )
    .delete('/:id', zValidator('param', IdParam), async (c) =>
      handle(c, () => opts.remove(c.req.valid('param').id)),
    )
}

const DiplomaCreate = z.object({
  id: z.string().min(1),
  deplomaName: z.string().min(1),
})
const RegionCreate = z.object({
  id: z.string().min(1),
  religionName: z.string().min(1),
})
const DivisionCreate = z.object({
  id: z.string().min(1),
  divisionName: z.string().min(1),
  regionId: z.string().min(1),
})
const LanguageCreate = z.object({
  id: z.string().min(1),
  language: z.string().min(1),
})
const MaritalStatusCreate = z.object({
  id: z.string().min(1),
  marital_status: z.string().min(1),
})
const NationalityCreate = z.object({
  id: z.string().min(1),
  nationality: z.string().min(1),
})
const ReligionCreate = z.object({
  id: z.string().min(1),
  religionName: z.string().min(1),
})
const SanctionCreate = z.object({
  id: z.string().min(1),
  sanctionName: z.string().min(1),
})
const SexCreate = z.object({
  id: z.string().min(1),
  sexName: z.string().min(1),
})
const ClassificationCreate = z.object({
  id: z.string().min(1),
  class_Name: z.string().min(1),
})
const WorkerUnionCreate = z.object({
  id: z.string().min(1),
  unionName: z.string().min(1),
})
const WorkStatusCreate = z.object({
  id: z.string().min(1),
  workStatus: z.string().min(1),
})
const TransferTypeCreate = z.object({
  Type_transfer: z.string().min(1),
})
const TransferTypeUpdate = TransferTypeCreate.partial()
const AbsenceCreate = z.object({
  id: z.string().min(1),
  absenceType: z.string().min(1),
})
const InsuranceCentreCreate = z.object({
  id: z.string().min(1),
  centreName: z.string().min(1),
})
const BankCreate = z.object({
  id: z.string().min(1),
  bankName: z.string().min(1),
})

export const personnelLookups = new Hono<{ Variables: AppVariables }>()
  .route(
    '/diplomas',
    lookupRouter({
      list: () => diplomaLookup.list(),
      get: (id) => diplomaLookup.get(id),
      create: (data) => diplomaLookup.create(data),
      update: (id, data) => diplomaLookup.update(id, data),
      remove: (id) => diplomaLookup.remove(id),
      createSchema: DiplomaCreate,
      updateSchema: DiplomaCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/regions',
    lookupRouter({
      list: () => regionLookup.list(),
      get: (id) => regionLookup.get(id),
      create: (data) => regionLookup.create(data),
      update: (id, data) => regionLookup.update(id, data),
      remove: (id) => regionLookup.remove(id),
      createSchema: RegionCreate,
      updateSchema: RegionCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/divisions',
    lookupRouter({
      list: (query) => divisionLookup.list(query),
      get: (id) => divisionLookup.get(id),
      create: (data) => divisionLookup.create(data),
      update: (id, data) => divisionLookup.update(id, data),
      remove: (id) => divisionLookup.remove(id),
      createSchema: DivisionCreate,
      updateSchema: DivisionCreate.omit({ id: true }).partial(),
      listQuerySchema: RegionQuery,
    }),
  )
  .route(
    '/languages',
    lookupRouter({
      list: () => languageLookup.list(),
      get: (id) => languageLookup.get(id),
      create: (data) => languageLookup.create(data),
      update: (id, data) => languageLookup.update(id, data),
      remove: (id) => languageLookup.remove(id),
      createSchema: LanguageCreate,
      updateSchema: LanguageCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/marital-statuses',
    lookupRouter({
      list: () => maritalStatusLookup.list(),
      get: (id) => maritalStatusLookup.get(id),
      create: (data) => maritalStatusLookup.create(data),
      update: (id, data) => maritalStatusLookup.update(id, data),
      remove: (id) => maritalStatusLookup.remove(id),
      createSchema: MaritalStatusCreate,
      updateSchema: MaritalStatusCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/nationalities',
    lookupRouter({
      list: () => nationalityLookup.list(),
      get: (id) => nationalityLookup.get(id),
      create: (data) => nationalityLookup.create(data),
      update: (id, data) => nationalityLookup.update(id, data),
      remove: (id) => nationalityLookup.remove(id),
      createSchema: NationalityCreate,
      updateSchema: NationalityCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/religions',
    lookupRouter({
      list: () => religionLookup.list(),
      get: (id) => religionLookup.get(id),
      create: (data) => religionLookup.create(data),
      update: (id, data) => religionLookup.update(id, data),
      remove: (id) => religionLookup.remove(id),
      createSchema: ReligionCreate,
      updateSchema: ReligionCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/sanctions',
    lookupRouter({
      list: () => sanctionLookup.list(),
      get: (id) => sanctionLookup.get(id),
      create: (data) => sanctionLookup.create(data),
      update: (id, data) => sanctionLookup.update(id, data),
      remove: (id) => sanctionLookup.remove(id),
      createSchema: SanctionCreate,
      updateSchema: SanctionCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/sexes',
    lookupRouter({
      list: () => sexLookup.list(),
      get: (id) => sexLookup.get(id),
      create: (data) => sexLookup.create(data),
      update: (id, data) => sexLookup.update(id, data),
      remove: (id) => sexLookup.remove(id),
      createSchema: SexCreate,
      updateSchema: SexCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/classifications',
    lookupRouter({
      list: () => classificationLookup.list(),
      get: (id) => classificationLookup.get(id),
      create: (data) => classificationLookup.create(data),
      update: (id, data) => classificationLookup.update(id, data),
      remove: (id) => classificationLookup.remove(id),
      createSchema: ClassificationCreate,
      updateSchema: ClassificationCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/worker-unions',
    lookupRouter({
      list: () => workerUnionLookup.list(),
      get: (id) => workerUnionLookup.get(id),
      create: (data) => workerUnionLookup.create(data),
      update: (id, data) => workerUnionLookup.update(id, data),
      remove: (id) => workerUnionLookup.remove(id),
      createSchema: WorkerUnionCreate,
      updateSchema: WorkerUnionCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/work-statuses',
    lookupRouter({
      list: () => workStatusLookup.list(),
      get: (id) => workStatusLookup.get(id),
      create: (data) => workStatusLookup.create(data),
      update: (id, data) => workStatusLookup.update(id, data),
      remove: (id) => workStatusLookup.remove(id),
      createSchema: WorkStatusCreate,
      updateSchema: WorkStatusCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/transfer-types',
    lookupRouter({
      list: () => transferTypeLookup.list(),
      get: (id) => transferTypeLookup.get(id),
      create: (data) => transferTypeLookup.create(data),
      update: (id, data) => transferTypeLookup.update(id, data),
      remove: (id) => transferTypeLookup.remove(id),
      createSchema: TransferTypeCreate,
      updateSchema: TransferTypeUpdate,
    }),
  )
  .route(
    '/absences',
    lookupRouter({
      list: () => absenceLookup.list(),
      get: (id) => absenceLookup.get(id),
      create: (data) => absenceLookup.create(data),
      update: (id, data) => absenceLookup.update(id, data),
      remove: (id) => absenceLookup.remove(id),
      createSchema: AbsenceCreate,
      updateSchema: AbsenceCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/insurance-centres',
    lookupRouter({
      list: () => insuranceCentreLookup.list(),
      get: (id) => insuranceCentreLookup.get(id),
      create: (data) => insuranceCentreLookup.create(data),
      update: (id, data) => insuranceCentreLookup.update(id, data),
      remove: (id) => insuranceCentreLookup.remove(id),
      createSchema: InsuranceCentreCreate,
      updateSchema: InsuranceCentreCreate.omit({ id: true }).partial(),
    }),
  )
  .route(
    '/banks',
    lookupRouter({
      list: () => bankLookup.list(),
      get: (id) => bankLookup.get(id),
      create: (data) => bankLookup.create(data),
      update: (id, data) => bankLookup.update(id, data),
      remove: (id) => bankLookup.remove(id),
      createSchema: BankCreate,
      updateSchema: BankCreate.omit({ id: true }).partial(),
    }),
  )
