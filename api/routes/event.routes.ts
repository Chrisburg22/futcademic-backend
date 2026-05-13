import { Router } from 'express';
import { getEvents, getEvent, createEvent, updateEvent, deleteEvent, cancelInstance, getTrainingsForDay, getTrainingsByEvent } from '../controllers/event.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';

const router = Router();

router.use(requireAuth, requireTenant);

router.get('/', getEvents);
router.get('/trainings', getTrainingsForDay);
router.get('/:id', getEvent);
router.get('/:id/trainings', getTrainingsByEvent);
router.post('/', requireRole('super_admin', 'admin', 'profesor'), createEvent);
router.put('/:id', requireRole('super_admin', 'admin', 'profesor'), updateEvent);
router.post('/cancel', requireRole('super_admin', 'admin', 'profesor'), cancelInstance);
router.delete('/:id', requireRole('super_admin', 'admin'), deleteEvent);

export default router;
