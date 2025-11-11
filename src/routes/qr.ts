import { Router } from 'express';
import { prisma } from '../prisma.js';
import { auth, type AuthReq } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { hashPassword } from '../lib/hash.js';
import { makePngDataUrl, makeSvgDataUrl } from '../lib/qrcode.js';

const router = Router();

// POST /qr/url  (create)
router.post('/url', auth, async (req: AuthReq, res) => {
  const {
    name,
    url,
    dynamic = false,
    password,
    expiresAt,
    errorCorrection = 'M',
    format = 'PNG'
  } = req.body ?? {};

  if (!url) return res.status(400).json({ error: 'url is required' });

  const passwordHash = password ? await hashPassword(password) : null;

  const qr = await prisma.qrCode.create({
    data: {
      name,
      originalUrl: url,
      dynamic,
      passwordHash,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      slug: nanoid(8),
      errorCorrection,
      format,
      ownerId: req.user!.id
    }
  });

  res.json(qr);
});

// GET /qr/:id (metadata)
router.get('/:id', auth, async (req: AuthReq, res) => {
  const qr = await prisma.qrCode.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id }
  });
  if (!qr) return res.status(404).json({ error: 'not found' });
  res.json(qr);
});

// PUT /qr/:id (update url if dynamic)
router.put('/:id', auth, async (req: AuthReq, res) => {
  const { url } = req.body ?? {};
  const qr = await prisma.qrCode.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id }
  });
  if (!qr) return res.status(404).json({ error: 'not found' });
  if (!qr.dynamic) return res.status(400).json({ error: 'not dynamic' });

  const updated = await prisma.qrCode.update({
    where: { id: qr.id },
    data: { originalUrl: url ?? qr.originalUrl }
  });

  res.json(updated);
});

// DELETE /qr/:id
router.delete('/:id', auth, async (req: AuthReq, res) => {
  const qr = await prisma.qrCode.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id }
  });
  if (!qr) return res.status(404).json({ error: 'not found' });

  await prisma.qrCode.delete({ where: { id: qr.id } });
  res.json({ ok: true });
});

// GET /qr/:id/image  -> returns data URL for now (simple)
router.get('/:id/image', auth, async (req: AuthReq, res) => {
  const qr = await prisma.qrCode.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id }
  });
  if (!qr) return res.status(404).json({ error: 'not found' });

  const target = qr.dynamic
    ? `${req.protocol}://${req.get('host')}/scan/${qr.slug}`
    : qr.originalUrl;

  const ecc = qr.errorCorrection as 'L'|'M'|'Q'|'H';
  if (qr.format === 'SVG') {
    const svg = await makeSvgDataUrl(target, ecc);
    return res.json({ image: svg, format: 'SVG' });
  }
  const png = await makePngDataUrl(target, ecc);
  return res.json({ image: png, format: 'PNG' });
});

export default router;
