import { Router } from 'express';
import { getVenues, createVenue, updateVenue, deleteVenue } from '../controllers/venue.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', getVenues);
router.post('/', requireRole('super_admin', 'admin'), createVenue);
router.patch('/:id', requireRole('super_admin', 'admin'), updateVenue);
router.delete('/:id', requireRole('super_admin', 'admin'), deleteVenue);

export default router;
