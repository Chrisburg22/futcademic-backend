import { Router } from 'express';
import { getCategories, createCategory, createFullCategory, assignTeacher, updateCategory, getMyCategoriesAsTeacher } from '../controllers/category.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/mine', requireRole('profesor'), getMyCategoriesAsTeacher);
router.get('/', getCategories);
router.post('/', requireRole('super_admin', 'admin'), createCategory);
router.post('/full', requireRole('super_admin', 'admin'), createFullCategory);
router.patch('/:id', requireRole('super_admin', 'admin'), updateCategory);
router.post('/:id/teachers', requireRole('super_admin', 'admin'), assignTeacher);

export default router;
