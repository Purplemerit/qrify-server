import { Router, type Response } from 'express';
import { prisma } from '../prisma.js';
import { hashPassword, comparePassword } from '../lib/hash.js';
import { signJwt, verifyJwt } from '../lib/jwt.js';
import { auth, type AuthReq } from '../middleware/auth.js';
import {
  generateToken,
  generateTokenExpiry,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../lib/email.js';

const router = Router();

// POST /auth/signup - User registration with automatic login
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (at least 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        emailVerified: true, // Skip email verification for direct login
      },
    });

    // Generate access token and refresh token for immediate login
    const accessToken = signJwt({ id: user.id, email: user.email });
    const refreshToken = generateToken();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 days

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Set secure httpOnly cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: user.id, email: user.email, emailVerified: user.emailVerified, role: user.role },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/login - User authentication
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await comparePassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate access token and refresh token
    const accessToken = signJwt({ id: user.id, email: user.email });
    const refreshToken = generateToken();
    const refreshTokenExpiry = new Date();
    refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30); // 30 days

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshTokenExpiry,
      },
    });

    // Set secure httpOnly cookies
    console.log('🍪 Server: Setting cookies for login...');
    console.log('🍪 Server: NODE_ENV =', process.env.NODE_ENV);
    console.log('🍪 Server: Setting accessToken cookie');
    
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    console.log('🍪 Server: Setting refreshToken cookie');
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS in production
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Allow cross-origin
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    console.log('🍪 Server: Cookies set successfully');

    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/logout - User logout
router.post('/logout', auth, async (req: AuthReq, res: Response) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      // Delete the refresh token from database
      await prisma.refreshToken.deleteMany({
        where: {
          token: refreshToken,
          userId: req.user!.id,
        },
      });
    }

    // Clear cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/refresh - Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    // Get refresh token from cookie instead of request body
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    // Find and validate refresh token
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Generate new access token
    const accessToken = signJwt({
      id: storedToken.user.id,
      email: storedToken.user.email,
    });

    // Set new access token cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/verify/request - Request email verification (resend)
router.post('/verify/request', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = generateToken();
    const verificationExpiry = generateTokenExpiry(24);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpiry,
      },
    });

    await sendVerificationEmail(email, verificationToken);

    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Verify request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/verify/confirm - Confirm email verification
router.post('/verify/confirm', async (req, res) => {
  try {
    const { token } = req.body ?? {};
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    if (user.emailVerificationExpires && user.emailVerificationExpires < new Date()) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify confirm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/password/forgot - Request password reset
router.post('/password/forgot', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Don't reveal if user exists or not for security
    if (!user) {
      return res.json({
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    }

    const resetToken = generateToken();
    const resetExpiry = generateTokenExpiry(1); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpiry,
      },
    });

    await sendPasswordResetEmail(email, resetToken);

    res.json({
      message: 'If an account exists with that email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/password/reset - Reset password with token
router.post('/password/reset', async (req, res) => {
  try {
    const { token, password } = req.body ?? {};
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    const hashed = await hashPassword(password);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /auth/me - Get current authenticated user
router.get('/me', auth, async (req: AuthReq, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
        language: true,
        dateFormat: true,
        timeFormat: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /auth/change-password - Change password for authenticated user
router.post('/change-password', auth, async (req: AuthReq, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const ok = await comparePassword(currentPassword, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and update new password
    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// PUT /auth/preferences - Update user preferences
router.put('/preferences', auth, async (req: AuthReq, res: Response) => {
  try {
    const { language, dateFormat, timeFormat } = req.body ?? {};
    
    // Validate input
    const validLanguages = ['en', 'es', 'fr'];
    const validDateFormats = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'];
    const validTimeFormats = ['12', '24'];
    
    if (language && !validLanguages.includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }
    
    if (dateFormat && !validDateFormats.includes(dateFormat)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    
    if (timeFormat && !validTimeFormats.includes(timeFormat)) {
      return res.status(400).json({ error: 'Invalid time format' });
    }

    const updateData: any = {};
    if (language) updateData.language = language;
    if (dateFormat) updateData.dateFormat = dateFormat;
    if (timeFormat) updateData.timeFormat = timeFormat;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid preferences provided' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        emailVerified: true,
        role: true,
        language: true,
        dateFormat: true,
        timeFormat: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ 
      message: 'Preferences updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /auth/account - Delete user account
router.delete('/account', auth, async (req: AuthReq, res: Response) => {
  try {
    const { password } = req.body ?? {};
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const ok = await comparePassword(password, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Delete user and all related data (cascading deletes handled by Prisma)
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Clear cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
