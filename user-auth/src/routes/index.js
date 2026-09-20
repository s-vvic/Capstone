import { Router } from 'express';
import authRoutes from './authRoutes.js';
import sessionRoutes from './sessionRoutes.js';
import planRoutes from './planRoutes.js';

const router = Router();

// /auth 하위 라우트 마운트
router.use('/auth/sessions', sessionRoutes);
router.use('/auth/plan', planRoutes);
router.use('/auth', authRoutes);

export default router;
