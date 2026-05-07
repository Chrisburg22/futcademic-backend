import { Router } from 'express';
import { getAdminDashboard, getProfesorDashboard, getPadreDashboard, getAlumnoDashboard } from '../controllers/dashboard.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();
router.use(requireAuth, requireTenant);

router.get('/admin', requireRole('super_admin', 'admin'), getAdminDashboard);
router.get('/profesor', requireRole('super_admin', 'admin', 'profesor'), getProfesorDashboard);
router.get('/padre', requireRole('super_admin', 'admin', 'padre'), getPadreDashboard);
router.get('/alumno', requireRole('super_admin', 'admin', 'alumno'), getAlumnoDashboard);

export default router;
