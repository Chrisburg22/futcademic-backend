import { Router } from 'express';
import multer from 'multer';
import { uploadAvatar, uploadLogo } from '../controllers/upload.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();
router.use(requireAuth, requireTenant);

router.post('/avatar', upload.single('image'), requireRole('super_admin', 'admin', 'profesor', 'padre', 'alumno'), uploadAvatar);
router.post('/logo', upload.single('image'), requireRole('super_admin', 'admin'), uploadLogo);

export default router;
