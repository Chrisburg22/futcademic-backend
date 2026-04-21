import { Router } from 'express';
import { getAttendancesByCategory, getAttendancesByStudent, saveAttendances } from '../controllers/attendance.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/category/:id', requireRole('super_admin', 'admin', 'profesor'), getAttendancesByCategory);
router.get('/student/:id', getAttendancesByStudent);
router.post('/', requireRole('super_admin', 'admin', 'profesor'), saveAttendances);

export default router;
