import { Router } from 'express';
import { getUsers, getTeacherDetails, updateUser, updateOwnProfile, completeOnboarding, changeOwnPassword, acknowledgePasswordChange, updatePushToken } from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.get('/', requireAuth, requireTenant, requireRole('super_admin', 'admin', 'profesor'), getUsers);
router.get('/teachers/:id', requireAuth, requireTenant, requireRole('super_admin', 'admin'), getTeacherDetails);
router.patch('/me/password', requireAuth, requireTenant, changeOwnPassword);
router.patch('/me/password-changed', requireAuth, requireTenant, acknowledgePasswordChange);
router.patch('/me/push-token', requireAuth, requireTenant, updatePushToken);
router.patch('/me/profile', requireAuth, requireTenant, updateOwnProfile);
router.post('/me/complete-onboarding', requireAuth, requireTenant, completeOnboarding);
router.put('/:id', requireAuth, requireTenant, requireRole('super_admin', 'admin'), updateUser);

export default router;
