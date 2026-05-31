import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'Hello from student-api!' });
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/version', (_req, res) => {
  res.json({ version: '1.0', commit: process.env.COMMIT_SHA ?? 'local' });
});

export default router;
