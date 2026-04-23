import { Router } from 'express';
import { updateSchool } from '../controllers/school.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.put('/:id', requireAuth, requireTenant, requireRole('super_admin', 'admin'), updateSchool);

export default router;
