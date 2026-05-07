import { Router } from 'express';
import { getAchievements, checkAndUnlockAchievements } from '../controllers/achievement.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();
router.use(requireAuth, requireTenant);

router.get('/', requireRole('super_admin', 'admin', 'alumno', 'padre'), getAchievements);
router.post('/check', requireRole('super_admin', 'admin', 'profesor'), checkAndUnlockAchievements);

export default router;
