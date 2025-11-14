import { type Request, type Response, type NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt.js';

export type AuthReq = Request & {
  user?: { id: string; email: string };
};

export function auth(req: AuthReq, res: Response, next: NextFunction) {
  // Try to get token from cookie first, then fallback to Authorization header
  let token = req.cookies?.accessToken;
  
  if (!token) {
    const header = req.headers['authorization'];
    if (header?.startsWith('Bearer ')) {
      token = header.slice(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = verifyJwt<{ id: string; email: string }>(token);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
