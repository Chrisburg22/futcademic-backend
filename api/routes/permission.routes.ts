import { Router } from 'express';
import { getTeacherPermissions, updateTeacherPermissions, getMyPermissions } from '../controllers/permission.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/mine', requireRole('profesor'), getMyPermissions);
router.get('/:id', requireRole('super_admin', 'admin'), getTeacherPermissions);
router.put('/:id', requireRole('super_admin', 'admin'), updateTeacherPermissions);

export default router;
