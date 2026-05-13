import { Router, Request, Response } from 'express';
import { registerSchool, inviteUser, inviteAdmin, resolveStudentUsername } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.post('/register', registerSchool);
router.post('/resolve-student', resolveStudentUsername);

router.post('/invite-teacher', requireAuth, requireTenant, requireRole('super_admin', 'admin'), (req: Request, res: Response) => {
  req.body.role = 'profesor';
  inviteUser(req, res);
});

router.post('/invite-parent', requireAuth, requireTenant, requireRole('super_admin', 'admin', 'profesor'), (req: Request, res: Response) => {
  req.body.role = 'padre';
  inviteUser(req, res);
});

router.post('/invite-admin', requireAuth, requireTenant, requireRole('super_admin', 'admin'), inviteAdmin);

export default router;
