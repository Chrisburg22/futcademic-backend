import { Router } from 'express';
import { linkChild, getMyChildren, unlinkChild } from '../controllers/parent.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant, requireRole('padre'));

router.get('/me/children', getMyChildren);
router.post('/link-child', linkChild);
router.delete('/children/:id', unlinkChild);

export default router;
