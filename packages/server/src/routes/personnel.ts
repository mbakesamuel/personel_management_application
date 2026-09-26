import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import {
  EmployeeCreateSchema,
  EmployeeListQuerySchema,
  EmployeeUpdateSchema,
  WorkflowReviewSchema,
} from '@perf-appraisal-app/shared'
import { z } from 'zod'
import type { AppVariables } from '../middleware/current-user.js'
import {
  classificationService,
  contractService,
  departureService,
  employeeService,
  employmentService,
  familyInfoService,
  identificationService,
  insuranceService,
  kinInfoService,
  maritalStatusService,
  movementService,
} from '../services/personnel.service.js'
import { personnelLookups } from './personnel-lookups.js'
import {
  PersonnelConflictError,
  PersonnelNotFoundError,
  PersonnelWorkflowError,
} from '../services/personnel-workflow.js'
import {
  ForbiddenError,
  requirePermission,
} from '../services/authz.service.js'

const ReviewSchema = WorkflowReviewSchema

const booleanQuery = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    return value === 'true' || value === '1'
  })

const ListQuerySchema = z.object({
  matricule: z.string().min(1).optional(),
  employmentId: z.coerce.number().int().positive().optional(),
  workflowStatus: z
    .enum(['PENDING', 'VALIDATED', 'REJECTED', 'SUPERSEDED'])
    .optional(),
  current: booleanQuery,
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  includeDeleted: booleanQuery,
})

const IdParam = z.object({ id: z.coerce.number().int().positive() })
const MatriculeParam = z.object({ matricule: z.string().min(1) })

const optionalString = z.string().optional().nullable()
const optionalNumber = z.number().int().optional().nullable()
const IdentificationCreateSchema = z.object({
  matricule: z.string().min(1),
  idNumber: z.string().min(1),
  date_issue: z.string().min(1),
  place_issue: z.string().min(1),
  date_expiry: z.string().min(1),
})
const IdentificationUpdateSchema = IdentificationCreateSchema.omit({
  matricule: true,
}).partial()

const InsuranceCreateSchema = z.object({
  matricule: z.string().min(1),
  ins_number: optionalString,
  centre_id: z.string().min(1),
  reg_date: optionalString,
})
const InsuranceUpdateSchema = InsuranceCreateSchema.omit({
  matricule: true,
}).partial()

const MaritalCreateSchema = z.object({
  matricule: z.string().min(1),
  maritalStatusId: z.string().min(1),
})
const MaritalUpdateSchema = z.object({
  maritalStatusId: z.string().min(1).optional(),
})

const EmploymentCreateSchema = z.object({
  matricule: z.string().min(1),
  dateEng: z.string().min(1),
  jobEng: z.string().min(1),
  placeEng: z.string().min(1),
  profession: optionalString,
  workStat: optionalString,
  unit: optionalString,
  contract: z.object({
    contractType: z.enum(['SPECIFIED', 'UNSPECIFIED']),
    startDate: z.string().min(1),
    endDate: optionalString,
  }),
})
const EmploymentUpdateSchema = z
  .object({
    dateEng: z.string().min(1).optional(),
    jobEng: z.string().min(1).optional(),
    placeEng: z.string().min(1).optional(),
    profession: optionalString,
    workStat: optionalString,
    unit: optionalString,
    contract: z
      .object({
        contractType: z.enum(['SPECIFIED', 'UNSPECIFIED']),
        startDate: z.string().min(1),
        endDate: optionalString,
      })
      .optional(),
  })
  .partial()

const ContractCreateSchema = z.object({
  employmentId: z.number().int().positive(),
  contractType: z.enum(['SPECIFIED', 'UNSPECIFIED']),
  startDate: z.string().min(1),
  endDate: optionalString,
})
const ContractUpdateSchema = z.object({
  contractType: z.enum(['SPECIFIED', 'UNSPECIFIED']).optional(),
  startDate: z.string().min(1).optional(),
  endDate: optionalString,
})

const FamilyCreateSchema = z.object({
  matricule: z.string().min(1),
  noSpouses: optionalNumber,
  noChildren: optionalNumber,
  relCode: optionalString,
  effectiveDate: optionalString,
})
const FamilyUpdateSchema = FamilyCreateSchema.omit({ matricule: true }).partial()

const KinCreateSchema = z.object({
  matricule: z.string().min(1),
  nextKinName: optionalString,
  nextKinRelation: optionalString,
  nextKinAddress: optionalString,
  effectiveDate: z.string().min(1),
})
const KinUpdateSchema = KinCreateSchema.omit({ matricule: true }).partial()

const DepartureCreateSchema = z.object({
  matricule: z.string().min(1),
  dateDeparture: optionalString,
  reasonDeparture: optionalString,
  effectiveDate: z.string().min(1),
})
const DepartureUpdateSchema = DepartureCreateSchema.omit({
  matricule: true,
}).partial()

const MovementCreateSchema = z.object({
  matricule: z.string().min(1),
  Eff_date: optionalString,
  From_unit_id: optionalString,
  To_unit_id: optionalString,
  Position: optionalString,
  trans_type_id: z.number().int().positive(),
})
const MovementUpdateSchema = MovementCreateSchema.omit({
  matricule: true,
}).partial()

const ClassificationCreateSchema = z.object({
  matricule: z.string().min(1),
  category: z.string().min(1),
  echelon: z.string().min(1),
  zone: optionalNumber,
  class_type: optionalString,
  caption: optionalString,
  letter_ref: optionalString,
  letter_date: optionalString,
  effective_date: z.string().min(1),
  comment: optionalString,
})
const ClassificationUpdateSchema = ClassificationCreateSchema.omit({
  matricule: true,
}).partial()

function mapPersonnelError(err: unknown) {
  if (err instanceof ForbiddenError) {
    return { status: 403 as const, message: err.message }
  }
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
    const mapped = mapPersonnelError(err)
    if (mapped) return c.json({ error: mapped.message }, mapped.status)
    throw err
  }
}

function actorId(c: { get: (key: 'currentUser') => { id: number } }) {
  return c.get('currentUser').id
}

function childRouter<TCreate, TUpdate>(opts: {
  list: (query: z.infer<typeof ListQuerySchema>) => Promise<unknown>
  get: (id: number) => Promise<unknown>
  create: (userId: number, data: TCreate) => Promise<unknown>
  update: (userId: number, id: number, data: TUpdate) => Promise<unknown>
  validate: (
    userId: number,
    id: number,
    review?: z.infer<typeof ReviewSchema>,
  ) => Promise<unknown>
  reject: (
    userId: number,
    id: number,
    review?: z.infer<typeof ReviewSchema>,
  ) => Promise<unknown>
  createSchema: z.ZodType<TCreate>
  updateSchema: z.ZodType<TUpdate>
}) {
  return new Hono<{ Variables: AppVariables }>()
    .get('/', zValidator('query', ListQuerySchema), async (c) =>
      handle(c, () => opts.list(c.req.valid('query'))),
    )
    .post('/', zValidator('json', opts.createSchema), async (c) =>
      handle(c, () => opts.create(actorId(c), c.req.valid('json')), 201),
    )
    .post('/:id/validate', zValidator('param', IdParam), async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canValidate')
        const body = await c.req.json().catch(() => ({}))
        return opts.validate(
          actorId(c),
          c.req.valid('param').id,
          ReviewSchema.parse(body),
        )
      }),
    )
    .post('/:id/reject', zValidator('param', IdParam), async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canValidate')
        const body = await c.req.json().catch(() => ({}))
        return opts.reject(
          actorId(c),
          c.req.valid('param').id,
          ReviewSchema.parse(body),
        )
      }),
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
          opts.update(actorId(c), c.req.valid('param').id, c.req.valid('json')),
        ),
    )
}

const employees = new Hono<{ Variables: AppVariables }>()
  .use('*', async (c, next) => {
    try {
      await requirePermission(c.get('currentUser'), 'canPersonnel')
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return c.json({ error: err.message }, 403)
      }
      throw err
    }
    await next()
  })
  .get('/', zValidator('query', EmployeeListQuerySchema), async (c) =>
    handle(c, () => employeeService.list(c.req.valid('query'))),
  )
  .get('/options', async (c) => handle(c, () => employeeService.options()))
  .post('/', zValidator('json', EmployeeCreateSchema), async (c) =>
    handle(c, () => employeeService.create(actorId(c), c.req.valid('json')), 201),
  )
  .post(
    '/:matricule/validate',
    zValidator('param', MatriculeParam),
    zValidator('json', ReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canValidate')
        return employeeService.validate(
          actorId(c),
          c.req.valid('param').matricule,
          c.req.valid('json'),
        )
      }),
  )
  .post(
    '/:matricule/reject',
    zValidator('param', MatriculeParam),
    zValidator('json', ReviewSchema),
    async (c) =>
      handle(c, async () => {
        await requirePermission(c.get('currentUser'), 'canValidate')
        return employeeService.reject(
          actorId(c),
          c.req.valid('param').matricule,
          c.req.valid('json'),
        )
      }),
  )
  .get('/:matricule', zValidator('param', MatriculeParam), async (c) =>
    handle(c, () => employeeService.get(c.req.valid('param').matricule)),
  )
  .patch(
    '/:matricule',
    zValidator('param', MatriculeParam),
    zValidator('json', EmployeeUpdateSchema),
    async (c) =>
      handle(c, () =>
        employeeService.update(
          actorId(c),
          c.req.valid('param').matricule,
          c.req.valid('json'),
        ),
      ),
  )

export const personnel = new Hono<{ Variables: AppVariables }>()
  .route('/employees', employees)
  .route('/lookups', personnelLookups)
  .route(
    '/identifications',
    childRouter({
      list: (query) => identificationService.list(query),
      get: (id) => identificationService.get(id),
      create: (userId, data) => identificationService.create(userId, data),
      update: (userId, id, data) =>
        identificationService.update(userId, id, data),
      validate: (userId, id, review) =>
        identificationService.validate(userId, id, review),
      reject: (userId, id, review) =>
        identificationService.reject(userId, id, review),
      createSchema: IdentificationCreateSchema,
      updateSchema: IdentificationUpdateSchema,
    }),
  )
  .route(
    '/insurances',
    childRouter({
      list: (query) => insuranceService.list(query),
      get: (id) => insuranceService.get(id),
      create: (userId, data) => insuranceService.create(userId, data),
      update: (userId, id, data) => insuranceService.update(userId, id, data),
      validate: (userId, id, review) =>
        insuranceService.validate(userId, id, review),
      reject: (userId, id, review) =>
        insuranceService.reject(userId, id, review),
      createSchema: InsuranceCreateSchema,
      updateSchema: InsuranceUpdateSchema,
    }),
  )
  .route(
    '/marital-statuses',
    childRouter({
      list: (query) => maritalStatusService.list(query),
      get: (id) => maritalStatusService.get(id),
      create: (userId, data) => maritalStatusService.create(userId, data),
      update: (userId, id, data) =>
        maritalStatusService.update(userId, id, data),
      validate: (userId, id, review) =>
        maritalStatusService.validate(userId, id, review),
      reject: (userId, id, review) =>
        maritalStatusService.reject(userId, id, review),
      createSchema: MaritalCreateSchema,
      updateSchema: MaritalUpdateSchema,
    }),
  )
  .route(
    '/employments',
    childRouter({
      list: (query) => employmentService.list(query),
      get: (id) => employmentService.get(id),
      create: (userId, data) => employmentService.create(userId, data),
      update: (userId, id, data) => employmentService.update(userId, id, data),
      validate: (userId, id, review) =>
        employmentService.validate(userId, id, review),
      reject: (userId, id, review) =>
        employmentService.reject(userId, id, review),
      createSchema: EmploymentCreateSchema,
      updateSchema: EmploymentUpdateSchema,
    }),
  )
  .route(
    '/contracts',
    childRouter({
      list: (query) => contractService.list(query),
      get: (id) => contractService.get(id),
      create: (userId, data) => contractService.create(userId, data),
      update: (userId, id, data) => contractService.update(userId, id, data),
      validate: (userId, id, review) =>
        contractService.validate(userId, id, review),
      reject: (userId, id, review) =>
        contractService.reject(userId, id, review),
      createSchema: ContractCreateSchema,
      updateSchema: ContractUpdateSchema,
    }),
  )
  .route(
    '/family-infos',
    childRouter({
      list: (query) => familyInfoService.list(query),
      get: (id) => familyInfoService.get(id),
      create: (userId, data) => familyInfoService.create(userId, data),
      update: (userId, id, data) => familyInfoService.update(userId, id, data),
      validate: (userId, id, review) =>
        familyInfoService.validate(userId, id, review),
      reject: (userId, id, review) =>
        familyInfoService.reject(userId, id, review),
      createSchema: FamilyCreateSchema,
      updateSchema: FamilyUpdateSchema,
    }),
  )
  .route(
    '/kin-infos',
    childRouter({
      list: (query) => kinInfoService.list(query),
      get: (id) => kinInfoService.get(id),
      create: (userId, data) => kinInfoService.create(userId, data),
      update: (userId, id, data) => kinInfoService.update(userId, id, data),
      validate: (userId, id, review) =>
        kinInfoService.validate(userId, id, review),
      reject: (userId, id, review) => kinInfoService.reject(userId, id, review),
      createSchema: KinCreateSchema,
      updateSchema: KinUpdateSchema,
    }),
  )
  .route(
    '/departures',
    childRouter({
      list: (query) => departureService.list(query),
      get: (id) => departureService.get(id),
      create: (userId, data) => departureService.create(userId, data),
      update: (userId, id, data) => departureService.update(userId, id, data),
      validate: (userId, id, review) =>
        departureService.validate(userId, id, review),
      reject: (userId, id, review) =>
        departureService.reject(userId, id, review),
      createSchema: DepartureCreateSchema,
      updateSchema: DepartureUpdateSchema,
    }),
  )
  .route(
    '/employee-movements',
    childRouter({
      list: (query) => movementService.list(query),
      get: (id) => movementService.get(id),
      create: (userId, data) => movementService.create(userId, data),
      update: (userId, id, data) => movementService.update(userId, id, data),
      validate: (userId, id, review) =>
        movementService.validate(userId, id, review),
      reject: (userId, id, review) =>
        movementService.reject(userId, id, review),
      createSchema: MovementCreateSchema,
      updateSchema: MovementUpdateSchema,
    }),
  )
  .route(
    '/employee-classifications',
    childRouter({
      list: (query) => classificationService.list(query),
      get: (id) => classificationService.get(id),
      create: (userId, data) => classificationService.create(userId, data),
      update: (userId, id, data) =>
        classificationService.update(userId, id, data),
      validate: (userId, id, review) =>
        classificationService.validate(userId, id, review),
      reject: (userId, id, review) =>
        classificationService.reject(userId, id, review),
      createSchema: ClassificationCreateSchema,
      updateSchema: ClassificationUpdateSchema,
    }),
  )
