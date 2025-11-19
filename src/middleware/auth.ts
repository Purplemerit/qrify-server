import { type Request, type Response, type NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt.js';

export type AuthReq = Request & {
  user?: { id: string; email: string; role?: string };
};

export function auth(req: AuthReq, res: Response, next: NextFunction) {
  // Try to get token from various cookie names, then fallback to Authorization header
  let token = req.cookies?.accessToken || req.cookies?.token;
  
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
    const payload = verifyJwt<{ id?: string; userId?: string; email: string; role?: string }>(token);
    // Handle both id and userId for backward compatibility
    const userId = payload.id || payload.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.user = { id: userId, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
