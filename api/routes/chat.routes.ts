import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireTenant, requireRole } from '../middlewares/tenant.middleware';
import {
  listConversations,
  getMessages,
  sendMessage,
  resolveConfirmation,
  deleteConversation,
} from '../controllers/chat.controller';

const router = Router();

router.use(requireAuth, requireTenant, requireRole('super_admin', 'admin'));

router.get('/conversations', listConversations);
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/confirm', resolveConfirmation);
router.delete('/conversations/:id', deleteConversation);

export default router;
