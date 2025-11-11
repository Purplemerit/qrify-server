import { type Request, type Response, type NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt.js';

export type AuthReq = Request & {
  user?: { id: string; email: string };
};

export function auth(req: AuthReq, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.slice(7);
  try {
    const payload = verifyJwt<{ id: string; email: string }>(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
