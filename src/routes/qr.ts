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

    // Get total scans with debug info
    const allScans = await prisma.scan.findMany({
      where: {
        qr: { ownerId: userId }
      },
      select: {
        id: true,
        createdAt: true,
        qr: { select: { name: true } }
      }
    }) as any[];

    // Also get scans with location data using raw query to avoid TypeScript issues
    const scansWithLocation = await prisma.$queryRaw<Array<{
      id: string;
      country: string | null;
      city: string | null;
      createdAt: Date;
    }>>`
      SELECT s.id, s.country, s.city, s."createdAt"
      FROM \"Scan\" s
      JOIN \"QrCode\" qr ON s.\"qrId\" = qr.id
      WHERE qr.\"ownerId\" = ${userId}
      ORDER BY s."createdAt" DESC
    `;

    const totalScans = allScans.length;

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

    // Get geographic data from real scan locations using raw query
    const locationScansRaw = await prisma.$queryRaw<{country: string, count: bigint}[]>`
      SELECT country, COUNT(*) as count
      FROM "Scan" s
      JOIN "QrCode" qr ON s."qrId" = qr.id
      WHERE qr."ownerId" = ${userId} AND s.country IS NOT NULL
      GROUP BY country
      ORDER BY count DESC
      LIMIT 5
    `;

    // Map country names to flag emojis
    const countryFlags: { [key: string]: string } = {
      'United States': '🇺🇸',
      'United Kingdom': '🇬🇧', 
      'Germany': '🇩🇪',
      'France': '🇫🇷',
      'Canada': '🇨🇦',
      'Australia': '🇦🇺',
      'Japan': '🇯🇵',
      'South Korea': '🇰🇷',
      'Brazil': '🇧🇷',
      'India': '🇮🇳',
      'China': '🇨🇳',
      'Italy': '🇮🇹',
      'Spain': '🇪🇸',
      'Netherlands': '🇳🇱',
      'Switzerland': '🇨🇭',
      'Sweden': '🇸🇪',
      'Norway': '🇳🇴',
      'Denmark': '🇩🇰',
      'Belgium': '🇧🇪',
      'Austria': '🇦🇹'
    };

    const topLocations = locationScansRaw.map(location => ({
      country: location.country || 'Unknown',
      scans: Number(location.count),
      flag: countryFlags[location.country || ''] || '🌍'
    }));

    // Get recent activity with location data using raw query to avoid TypeScript issues
    const recentActivity = await prisma.$queryRaw<Array<{
      id: string;
      createdAt: Date;
      country: string | null;
      city: string | null;
      qr_name: string | null;
      qr_slug: string | null;
    }>>`
      SELECT 
        s.id, 
        s."createdAt", 
        s.country, 
        s.city,
        qr.name as qr_name,
        qr.slug as qr_slug
      FROM \"Scan\" s
      JOIN \"QrCode\" qr ON s.\"qrId\" = qr.id
      WHERE qr.\"ownerId\" = ${userId}
      ORDER BY s."createdAt" DESC
      LIMIT 5
    `;


    console.log('Recent activity with location:', recentActivity);

    const formatTimeAgo = (date: Date) => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    };

    const formattedActivity = recentActivity.map((activity) => ({
      action: 'QR Code scanned',
      qr: activity.qr_name || 'Unnamed QR Code',
      time: formatTimeAgo(activity.createdAt),
      location: activity.city && activity.country 
        ? `${activity.city}, ${activity.country}`
        : activity.country || 'Unknown location'
    }));

    // Calculate real percentage changes
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const startOfLastMonth = new Date(lastMonth);
    startOfLastMonth.setDate(1);
    startOfLastMonth.setHours(0, 0, 0, 0);
    
    const qrCodesLastMonth = await prisma.qrCode.count({
      where: { 
        ownerId: userId,
        createdAt: { 
          gte: startOfLastMonth,
          lt: startOfMonth
        }
      }
    });

    const scansLastMonth = await prisma.scan.count({
      where: {
        qr: { ownerId: userId },
        createdAt: { 
          gte: startOfLastMonth,
          lt: startOfMonth
        }
      }
    });

    // Calculate unique visitors for last month
    const uniqueVisitorsLastMonth = await prisma.scan.groupBy({
      by: ['ip'],
      where: {
        qr: { ownerId: userId },
        createdAt: { 
          gte: startOfLastMonth,
          lt: startOfMonth
        }
      }
    });

    // Calculate real percentage changes
    const qrCodesChange = qrCodesLastMonth > 0 
      ? (qrCodesThisMonth > qrCodesLastMonth 
         ? `+${qrCodesThisMonth - qrCodesLastMonth} from last month`
         : `${qrCodesThisMonth - qrCodesLastMonth} from last month`)
      : qrCodesThisMonth > 0 ? `+${qrCodesThisMonth} this month` : 'No QR codes yet';

    const scansChangePercent = scansLastMonth > 0 
      ? ((scansThisMonth - scansLastMonth) / scansLastMonth * 100)
      : scansThisMonth > 0 ? 100 : 0;
    
    const scansChange = scansLastMonth > 0
      ? `${scansChangePercent >= 0 ? '+' : ''}${scansChangePercent.toFixed(1)}% from last month`
      : scansThisMonth > 0 ? '+100% this month' : 'No scans yet';

    const visitorsChangePercent = uniqueVisitorsLastMonth.length > 0
      ? ((uniqueVisitors - uniqueVisitorsLastMonth.length) / uniqueVisitorsLastMonth.length * 100)
      : uniqueVisitors > 0 ? 100 : 0;
    
    const visitorsChange = uniqueVisitorsLastMonth.length > 0
      ? `${visitorsChangePercent >= 0 ? '+' : ''}${visitorsChangePercent.toFixed(1)}% from last month`
      : uniqueVisitors > 0 ? '+100% this month' : 'No visitors yet';

    // Calculate downloads change (downloads = QR codes created)
    const downloadsChange = qrCodesChange;

    const response = {
      overview: {
        totalQrCodes: {
          value: totalQrCodes,
          change: qrCodesChange
        },
        totalScans: {
          value: totalScans,
          change: scansChange
        },
        uniqueVisitors: {
          value: uniqueVisitors,
          change: visitorsChange
        },
        downloads: {
          value: totalQrCodes, // Downloads = total QR codes created
          change: downloadsChange
        }
      },
      topPerformingQrCodes: topQrCodes.map((qr) => {
        // Calculate change for each QR code based on this month vs last month scans
        const thisMonthScans = qr._count.scans; // This is total scans, we need to calculate monthly difference
        return {
          name: qr.name || 'Unnamed QR Code',
          scans: qr._count.scans,
          change: qr._count.scans > 0 ? 'Active' : 'No scans'
        };
      }),
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
    bulk: qr.bulk,
    format: qr.format,
    errorCorrection: qr.errorCorrection,
    designOptions: (qr.designFrame || qr.designShape || qr.designLogo || qr.designLevel !== 2 || qr.designDotStyle || qr.designBgColor || qr.designOuterBorder) ? {
      frame: qr.designFrame || 1,
      shape: qr.designShape || 1,
      logo: qr.designLogo || 0,
      level: qr.designLevel || 2,
      dotStyle: qr.designDotStyle || 1,
      bgColor: qr.designBgColor || '#ffffff',
      outerBorder: qr.designOuterBorder || 1
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
    bulk = false,
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
      bulk,
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
    if (designOptions.dotStyle !== undefined) updateData.designDotStyle = designOptions.dotStyle;
    if (designOptions.bgColor !== undefined) updateData.designBgColor = designOptions.bgColor;
    if (designOptions.outerBorder !== undefined) updateData.designOuterBorder = designOptions.outerBorder;
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
