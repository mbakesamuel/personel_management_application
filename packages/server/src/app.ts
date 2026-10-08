import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth.js'
import { corsMiddleware } from './middleware/cors.js'
import {
  currentUserMiddleware,
  type AppVariables,
} from './middleware/current-user.js'
import { appraisals } from './routes/appraisals.js'
import { dashboard } from './routes/dashboard.js'
import { dashboardGroups } from './routes/dashboard-groups.js'
import { auth } from './routes/auth.js'
import { decisionLevels } from './routes/decision-levels.js'
import { financialYears } from './routes/financial-years.js'
import { health } from './routes/health.js'
import { letterCc } from './routes/letter-cc.js'
import { organization } from './routes/organization.js'
import { allowances } from './routes/allowances.js'
import { communication } from './routes/communication.js'
import { positionKeywords } from './routes/position-keywords.js'
import { allowanceMatrix } from './routes/allowance-matrix.js'
import { reports } from './routes/reports.js'
import { roles } from './routes/roles.js'
import { jurisdictions } from './routes/jurisdictions.js'
import { sectionThro } from './routes/section-thro.js'
import { users } from './routes/users.js'
import { leave } from './routes/leave.js'
import { permissions } from './routes/permissions.js'
import { personnel } from './routes/personnel.js'

const app = new Hono<{ Variables: AppVariables }>()
  .use('*', corsMiddleware)
  .use('*', authMiddleware)
  .use('*', currentUserMiddleware)
  .route('/health', health)
  .route('/auth', auth)
  .route('/users', users)
  .route('/roles', roles)
  .route('/jurisdictions', jurisdictions)
  .route('/financial-years', financialYears)
  .route('/organization', organization)
  .route('/allowances', allowances)
  .route('/communication', communication)
  .route('/position-keywords', positionKeywords)
  .route('/allowance-matrix', allowanceMatrix)
  .route('/letter-cc', letterCc)
  .route('/decision-levels', decisionLevels)
  .route('/section-thro', sectionThro)
  .route('/appraisals', appraisals)
  .route('/reports', reports)
  .route('/dashboard', dashboard)
  .route('/dashboard-groups', dashboardGroups)
  .route('/personnel', personnel)
  .route('/leave', leave)
  .route('/permissions', permissions)

export type AppType = typeof app
export { app }
