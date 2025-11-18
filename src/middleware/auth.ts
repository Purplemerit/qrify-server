import { type Request, type Response, type NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt.js';

export type AuthReq = Request & {
  user?: { id: string; email: string };
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
    const payload = verifyJwt<{ userId: string; email: string; role: string }>(token);
    // Map the payload to match expected format
    req.user = { id: payload.userId, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
