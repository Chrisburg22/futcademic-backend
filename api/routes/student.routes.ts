import { Router } from 'express';
import { getStudents, getStudentDetails, createStudent, updateStudent, updateUniform, updateStatus, deleteStudent, getDeletedStudents, getStudentStats, getStudentTeam } from '../controllers/student.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', requireRole('super_admin', 'admin', 'profesor', 'padre'), getStudents);
router.get('/deleted', requireRole('super_admin', 'admin'), getDeletedStudents);
router.get('/:id', requireRole('super_admin', 'admin', 'profesor', 'padre'), getStudentDetails);
router.post('/', requireRole('super_admin', 'admin', 'profesor'), createStudent);
router.put('/:id', requireRole('super_admin', 'admin', 'profesor'), updateStudent);
router.patch('/:id/uniform', requireRole('super_admin', 'admin', 'profesor'), updateUniform);
router.patch('/:id/status', requireRole('super_admin', 'admin'), updateStatus);
router.delete('/:id', requireRole('super_admin', 'admin'), deleteStudent);
router.get('/:id/stats', requireRole('super_admin', 'admin', 'profesor', 'padre', 'alumno'), getStudentStats);
router.get('/:id/team', requireRole('super_admin', 'admin', 'alumno'), getStudentTeam);

export default router;
