import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import studentRoutes from './student.routes';
import attendanceRoutes from './attendance.routes';
import paymentRoutes from './payment.routes';
import eventRoutes from './event.routes';
import schoolRoutes from './school.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/students', studentRoutes);
router.use('/attendances', attendanceRoutes);
router.use('/payments', paymentRoutes);
router.use('/events', eventRoutes);
router.use('/schools', schoolRoutes);

export default router;
