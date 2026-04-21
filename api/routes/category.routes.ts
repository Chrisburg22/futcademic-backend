import { Router } from 'express';
import { getCategories, createCategory, assignTeacher, updateCategory } from '../controllers/category.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', getCategories);
router.post('/', requireRole('super_admin', 'admin'), createCategory);
router.patch('/:id', requireRole('super_admin', 'admin'), updateCategory);
router.post('/:id/teachers', requireRole('super_admin', 'admin'), assignTeacher);

export default router;
