import { Router } from 'express';
import { getPayments, getPaymentsByStudent, registerStudentPayment, registerTeacherPayment } from '../controllers/payment.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', requireRole('super_admin', 'admin'), getPayments);
router.get('/student/:id', getPaymentsByStudent);
router.post('/students', requireRole('super_admin', 'admin'), registerStudentPayment);
router.post('/teachers', requireRole('super_admin', 'admin'), registerTeacherPayment);

export default router;
