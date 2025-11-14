import { Router } from 'express';
import { prisma } from '../prisma.js';
import { auth, type AuthReq } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { hashPassword } from '../lib/hash.js';
import { makePngDataUrl, makeSvgDataUrl } from '../lib/qrcode.js';

const router = Router();

// GET /qr/stats (get user's QR code statistics) - MUST be before /:id route
router.get('/stats', auth, async (req: AuthReq, res) => {
  try {
    const userId = req.user!.id;
    
    // Get total QR codes count
    const totalQrCodes = await prisma.qrCode.count({
      where: { ownerId: userId }
    });

    // Get QR codes created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const qrCodesThisMonth = await prisma.qrCode.count({
      where: { 
        ownerId: userId,
        createdAt: { gte: startOfMonth }
      }
    });

    // Get total scans
    const totalScansResult = await prisma.scan.groupBy({
      by: ['qrId'],
      _count: { _all: true },
      where: {
        qr: { ownerId: userId }
      }
    });
    const totalScans = totalScansResult.reduce((sum, item) => sum + item._count._all, 0);

    // Get scans this month
    const scansThisMonth = await prisma.scan.count({
      where: {
        qr: { ownerId: userId },
        createdAt: { gte: startOfMonth }
      }
    });

    // Get unique visitors (approximate by unique IPs)
    const uniqueVisitorsResult = await prisma.scan.groupBy({
      by: ['ip'],
      where: {
        qr: { ownerId: userId },
        createdAt: { gte: startOfMonth }
      }
    });
    const uniqueVisitors = uniqueVisitorsResult.length;

    // Get downloads (same as QR codes created for now)
    const downloads = totalQrCodes;

    // Get top performing QR codes
    const topQrCodes = await prisma.qrCode.findMany({
      where: { ownerId: userId },
      include: {
        _count: {
          select: { scans: true }
        }
      },
      orderBy: {
        scans: {
          _count: 'desc'
        }
      },
      take: 5
    });

    // Get device analytics (based on user agents)
    const scansWithUA = await prisma.scan.findMany({
      where: {
        qr: { ownerId: userId },
        createdAt: { gte: startOfMonth }
      },
      select: { ua: true }
    });

    const deviceStats = scansWithUA.reduce((acc, scan) => {
      const ua = scan.ua?.toLowerCase() || '';
      if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
        acc.mobile++;
      } else if (ua.includes('tablet') || ua.includes('ipad')) {
        acc.tablet++;
      } else {
        acc.desktop++;
      }
      return acc;
    }, { mobile: 0, desktop: 0, tablet: 0 });

    const totalDeviceScans = deviceStats.mobile + deviceStats.desktop + deviceStats.tablet || 1;
    const deviceAnalytics = [
      {
        device: 'Mobile',
        percentage: Math.round((deviceStats.mobile / totalDeviceScans) * 100),
        scans: deviceStats.mobile
      },
      {
        device: 'Desktop',
        percentage: Math.round((deviceStats.desktop / totalDeviceScans) * 100),
        scans: deviceStats.desktop
      },
      {
        device: 'Tablet',
        percentage: Math.round((deviceStats.tablet / totalDeviceScans) * 100),
        scans: deviceStats.tablet
      }
    ];

    // Get geographic data (mock for now - would need IP geolocation service)
    const topLocations = [
      { country: "United States", scans: Math.floor(totalScans * 0.4), flag: "🇺🇸" },
      { country: "United Kingdom", scans: Math.floor(totalScans * 0.25), flag: "🇬🇧" },
      { country: "Germany", scans: Math.floor(totalScans * 0.15), flag: "🇩🇪" },
      { country: "France", scans: Math.floor(totalScans * 0.12), flag: "🇫🇷" },
      { country: "Canada", scans: Math.floor(totalScans * 0.08), flag: "🇨🇦" },
    ];

    // Get recent activity
    const recentActivity = await prisma.scan.findMany({
      where: {
        qr: { ownerId: userId }
      },
      include: {
        qr: {
          select: { name: true, slug: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const formatTimeAgo = (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      return `${diffDays} days ago`;
    };

    const formattedActivity = recentActivity.map(activity => ({
      action: 'QR Code scanned',
      qr: activity.qr.name || 'Unnamed QR Code',
      time: formatTimeAgo(activity.createdAt),
      location: 'Unknown' // Would need IP geolocation
    }));

    // Calculate percentage changes (mock calculation)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const qrCodesLastMonth = await prisma.qrCode.count({
      where: { 
        ownerId: userId,
        createdAt: { 
          gte: lastMonth,
          lt: startOfMonth
        }
      }
    });

    const scansLastMonth = await prisma.scan.count({
      where: {
        qr: { ownerId: userId },
        createdAt: { 
          gte: lastMonth,
          lt: startOfMonth
        }
      }
    });

    const qrCodesChange = qrCodesLastMonth > 0 
      ? `+${qrCodesThisMonth - qrCodesLastMonth}`
      : `+${qrCodesThisMonth}`;

    const scansChangePercent = scansLastMonth > 0 
      ? ((scansThisMonth - scansLastMonth) / scansLastMonth * 100).toFixed(1)
      : '100';

    const response = {
      overview: {
        totalQrCodes: {
          value: totalQrCodes,
          change: qrCodesChange + ' from last month'
        },
        totalScans: {
          value: totalScans,
          change: `+${scansChangePercent}% from last month`
        },
        uniqueVisitors: {
          value: uniqueVisitors,
          change: '+8.2% from last month' // Mock for now
        },
        downloads: {
          value: downloads,
          change: '+4 from last week' // Mock for now
        }
      },
      topPerformingQrCodes: topQrCodes.map((qr, index) => ({
        name: qr.name || 'Unnamed QR Code',
        scans: qr._count.scans,
        change: `+${5 + index * 2}%` // Mock percentage change
      })),
      deviceAnalytics,
      topLocations,
      recentActivity: formattedActivity
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

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
    designOptions: (qr.designFrame || qr.designShape || qr.designLogo || qr.designLevel !== 2) ? {
      frame: qr.designFrame || 1,
      shape: qr.designShape || 1,
      logo: qr.designLogo || 0,
      level: qr.designLevel || 2
    } : null
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

// PUT /qr/:id (update url if dynamic, or design options, or name)
router.put('/:id', auth, async (req: AuthReq, res) => {
  console.log('PUT request body:', req.body);
  const { url, designOptions, status, name } = req.body ?? {};
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

  // Update name if provided
  if (name !== undefined) {
    updateData.name = name;
  }

  // Update design options if provided
  if (designOptions) {
    console.log('Updating design options:', designOptions);
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

  console.log('Update data:', updateData);
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

  // Delete associated scans first to avoid foreign key constraint
  await prisma.scan.deleteMany({ 
    where: { qrId: qr.id } 
  });

  // Then delete the QR code
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
