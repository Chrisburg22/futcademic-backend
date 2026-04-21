import { Router } from 'express';
import { getEvents, createEvent, deleteEvent, cancelInstance, getTrainingsForDay, getTrainingsByEvent } from '../controllers/event.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', getEvents);
router.get('/trainings', getTrainingsForDay);
router.get('/:id/trainings', getTrainingsByEvent);
router.post('/', requireRole('super_admin', 'admin'), createEvent);
router.post('/cancel', requireRole('super_admin', 'admin'), cancelInstance);
router.delete('/:id', requireRole('super_admin', 'admin'), deleteEvent);

export default router;
