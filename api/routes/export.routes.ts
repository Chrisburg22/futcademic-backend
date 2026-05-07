import { Router } from 'express';
import { exportPayments, exportAttendance } from '../controllers/export.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();
router.use(requireAuth, requireTenant);

router.get('/payments', requireRole('super_admin', 'admin'), exportPayments);
router.get('/attendance', requireRole('super_admin', 'admin'), exportAttendance);

export default router;
