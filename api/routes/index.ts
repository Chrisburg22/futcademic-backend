import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import studentRoutes from './student.routes';
import attendanceRoutes from './attendance.routes';
import paymentRoutes from './payment.routes';
import eventRoutes from './event.routes';
import schoolRoutes from './school.routes';
import venueRoutes from './venue.routes';
import permissionRoutes from './permission.routes';
import dashboardRoutes from './dashboard.routes';
import exportRoutes from './export.routes';
import notificationRoutes from './notification.routes';
import achievementRoutes from './achievement.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/students', studentRoutes);
router.use('/attendances', attendanceRoutes);
router.use('/payments', paymentRoutes);
router.use('/events', eventRoutes);
router.use('/schools', schoolRoutes);
router.use('/venues', venueRoutes);
router.use('/permissions', permissionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/export', exportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/achievements', achievementRoutes);
router.use('/upload', uploadRoutes);

export default router;
