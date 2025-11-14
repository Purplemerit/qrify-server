import { Router } from 'express';
import { prisma } from '../prisma.js';
import { auth, type AuthReq } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { hashPassword } from '../lib/hash.js';
import { makePngDataUrl, makeSvgDataUrl } from '../lib/qrcode.js';

const router = Router();

// GET /qr/my-codes (get all user's QR codes)
router.get('/my-codes', auth, async (req: AuthReq, res) => {
  const qrCodes = await prisma.qrCode.findMany({
    where: { ownerId: req.user!.id },
    include: {
      _count: {
        select: { scans: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Transform the data to match frontend expectations
  const transformedQrCodes = qrCodes.map(qr => ({
    id: qr.id,
    title: qr.name || 'Unnamed QR Code',
    name: qr.name,
    type: qr.dynamic ? 'Dynamic' : 'Static',
    status: qr.expiresAt && qr.expiresAt < new Date() ? 'Inactive' : 'Active',
    data: qr.originalUrl,
    scans: qr._count.scans,
    created_at: qr.createdAt,
    slug: qr.slug,
    dynamic: qr.dynamic,
    format: qr.format,
    errorCorrection: qr.errorCorrection,
    designOptions: {
      frame: qr.designFrame || 1,
      shape: qr.designShape || 1,
      logo: qr.designLogo || 0,
      level: qr.designLevel || 2
    }
  }));

  res.json(transformedQrCodes);
});

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

// PUT /qr/:id (update url if dynamic, or design options)
router.put('/:id', auth, async (req: AuthReq, res) => {
  const { url, designOptions, status } = req.body ?? {};
  const qr = await prisma.qrCode.findFirst({
    where: { id: req.params.id, ownerId: req.user!.id }
  });
  if (!qr) return res.status(404).json({ error: 'not found' });

  // Prepare update data
  const updateData: any = {};
  
  // Update URL only for dynamic QR codes
  if (url !== undefined) {
    if (!qr.dynamic) return res.status(400).json({ error: 'not dynamic' });
    updateData.originalUrl = url;
  }

  // Update design options if provided
  if (designOptions) {
    if (designOptions.frame !== undefined) updateData.designFrame = designOptions.frame;
    if (designOptions.shape !== undefined) updateData.designShape = designOptions.shape;
    if (designOptions.logo !== undefined) updateData.designLogo = designOptions.logo;
    if (designOptions.level !== undefined) updateData.designLevel = designOptions.level;
  }

  // Update expiration based on status
  if (status === 'inactive') {
    updateData.expiresAt = new Date(); // Set to current time to make it inactive
  } else if (status === 'active') {
    updateData.expiresAt = null; // Remove expiration to make it active
  }

  const updated = await prisma.qrCode.update({
    where: { id: qr.id },
    data: updateData
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
