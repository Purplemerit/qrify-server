import { Router } from 'express';
import { prisma } from '../prisma.js';
import { comparePassword } from '../lib/hash.js';
import { getLocationFromIP } from '../lib/geolocation.js';

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

  // Get location from IP (async, don't block redirect)
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.toString()?.split(',')[0];
  
  console.log('Scan request - IP:', clientIP, 'User-Agent:', req.headers['user-agent']);
  
  // Log scan with location data (run async to not delay redirect)
  const logScan = async () => {
    try {
      console.log('Getting location for IP:', clientIP);
      const locationData = await getLocationFromIP(clientIP || '');
      console.log('Location data received:', locationData);
      
      const scanRecord = await prisma.scan.create({
        data: {
          qrId: qr.id,
          ip: clientIP || null,
          ua: req.headers['user-agent'] ?? '',
          country: locationData.country,
          city: locationData.city,
          region: locationData.region,
          latitude: locationData.latitude,
          longitude: locationData.longitude
        }
      });
      
      console.log('Scan logged successfully:', scanRecord);
    } catch (error) {
      console.error('Failed to log scan with location:', error);
      // Fallback: log scan without location data
      try {
        const fallbackScan = await prisma.scan.create({
          data: {
            qrId: qr.id,
            ip: clientIP || null,
            ua: req.headers['user-agent'] ?? ''
          }
        });
        console.log('Fallback scan logged:', fallbackScan);
      } catch (fallbackError) {
        console.error('Failed to log even fallback scan:', fallbackError);
      }
    }
  };

  // Start logging async but don't wait for it
  logScan();

  return res.redirect(qr.originalUrl);
});

export default router;
