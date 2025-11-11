import { Router } from 'express';
import { prisma } from '../prisma.js';
import { comparePassword } from '../lib/hash.js';

const router = Router();

/**
 * GET /scan/:slug
 * If password-protected, requires ?password=...
 * If expired, 410
 * Logs scan, then redirects.
 */
router.get('/:slug', async (req, res) => {
  const slug = req.params.slug;
  const password = req.query.password?.toString();

  const qr = await prisma.qrCode.findUnique({ where: { slug } });
  if (!qr) return res.status(404).send('QR not found');

  // check expiry
  if (qr.expiresAt && new Date() > qr.expiresAt) {
    return res.status(410).send('QR expired');
  }

  // check password
  if (qr.passwordHash) {
    if (!password) return res.status(401).send('Password required');
    const ok = await comparePassword(password, qr.passwordHash);
    if (!ok) return res.status(403).send('Wrong password');
  }

  // log scan
  await prisma.scan.create({
    data: {
      qrId: qr.id,
      ip: req.ip,
      ua: req.headers['user-agent'] ?? ''
    }
  });

  return res.redirect(qr.originalUrl);
});

export default router;
