import { Router } from 'express';
import { requireStaff } from '../../middleware/auth.js';
import { authorityAdmin } from './admin.js';
import { authorityCases } from './cases.js';
import { authorityOverview } from './overview.js';
import { authorityPatterns } from './patterns.js';
import { authorityReports } from './reports.js';

/** Everything under /v1/authority requires a valid, non-revoked staff session. */
export const authorityRouter = Router();
authorityRouter.use(requireStaff);
authorityRouter.use(authorityOverview);
authorityRouter.use(authorityPatterns);
authorityRouter.use(authorityReports);
authorityRouter.use(authorityCases);
authorityRouter.use(authorityAdmin);
