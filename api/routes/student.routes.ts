import { Router } from 'express';
import { getStudents, getStudentDetails, createStudent, updateStudent, updateUniform } from '../controllers/student.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', requireRole('super_admin', 'admin', 'profesor', 'padre'), getStudents);
router.get('/:id', requireRole('super_admin', 'admin', 'profesor', 'padre'), getStudentDetails);
router.post('/', requireRole('super_admin', 'admin', 'profesor'), createStudent);
router.put('/:id', requireRole('super_admin', 'admin', 'profesor'), updateStudent);
router.patch('/:id/uniform', requireRole('super_admin', 'admin', 'profesor'), updateUniform);

export default router;
