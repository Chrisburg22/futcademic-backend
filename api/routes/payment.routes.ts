import { Router } from 'express';
import { getPayments, getPaymentsByStudent, getPendingPayments, registerStudentPayment, registerTeacherPayment, getAccountStatement } from '../controllers/payment.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', requireRole('super_admin', 'admin'), getPayments);
router.get('/pending', requireRole('super_admin', 'admin'), getPendingPayments);
router.get('/student/:id', getPaymentsByStudent);
router.post('/students', requireRole('super_admin', 'admin'), registerStudentPayment);
router.post('/teachers', requireRole('super_admin', 'admin'), registerTeacherPayment);
router.get('/account-statement/:studentId', requireRole('super_admin', 'admin', 'padre'), getAccountStatement);

export default router;
