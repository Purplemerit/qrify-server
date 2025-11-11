import { Router } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { signJwt } from '../lib/jwt.js';

const router = Router();

// POST /auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ error: 'email already in use' });

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, password: hashed } });
  const token = signJwt({ id: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email } });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await comparePassword(password, user.password);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = signJwt({ id: user.id, email: user.email });
  res.json({ token, user: { id: user.id, email: user.email } });
});

export default router;
