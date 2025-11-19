import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export interface EmailConfig {
  from: string;
  baseUrl: string;
}

export const emailConfig: EmailConfig = {
  from: env.EMAIL_FROM,
  baseUrl: env.CLIENT_URL,
};

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD,
  },
});

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateTokenExpiry(hours: number = 24): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verificationUrl = `${emailConfig.baseUrl}/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Welcome to QRIfy!</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
        <p>Thank you for signing up for QRIfy! To complete your registration, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${verificationUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create an account with QRIfy, you can safely ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} QRIfy. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail(email, 'Verify Your Email - QRIfy', html);
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  const resetUrl = `${emailConfig.baseUrl}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Password Reset</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${resetUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} QRIfy. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail(email, 'Reset Your Password - QRIfy', html);
}

export async function sendEmailChangeVerificationEmail(newEmail: string, token: string): Promise<void> {
  const verificationUrl = `${emailConfig.baseUrl}/verify-email-change?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verify Your New Email</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">Email Change Request</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Verify Your New Email Address</h2>
        <p>You requested to change your email address on QRIfy. Please verify your new email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify New Email</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${verificationUrl}</p>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">This link will expire in 24 hours.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this email change, please contact support immediately.</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} QRIfy. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail(newEmail, 'Verify Your New Email - QRIfy', html);
}

export async function sendInvitationEmail(
  email: string, 
  inviterName: string, 
  role: string, 
  token: string
): Promise<void> {
  const inviteUrl = `${emailConfig.baseUrl}/signup?invite=${token}`;
  
  const roleDescription = {
    admin: 'Full access to all features and settings',
    editor: 'Can create and manage QR codes, limited settings access',
    viewer: 'Read-only access to QR codes and analytics'
  }[role.toLowerCase()] || 'Access to QRify';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>You're Invited to QRify</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🎉 You're Invited to QRify!</h1>
      </div>
      <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Welcome to the team!</h2>
        <p><strong>${inviterName}</strong> has invited you to join their QRify team.</p>
        
        <p>You've been assigned the role of:</p>
        <div style="background: #e5f3ff; color: #1e40af; padding: 8px 16px; border-radius: 16px; display: inline-block; font-weight: 600; margin: 10px 0;">
          ${role.toUpperCase()}
        </div>
        <p style="color: #666; font-style: italic;">${roleDescription}</p>
        
        <p>Click the button below to activate your account and get started:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">Activate Account</a>
        </div>
        
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 20px 0;">
          <strong>Note:</strong> This invitation link will expire in 7 days. If you don't activate your account by then, you'll need to request a new invitation.
        </div>
        
        <p style="color: #666; font-size: 14px;">Already have an account? You can sign in directly and your new role will be applied automatically.</p>
        
        <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
        <p style="background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px;">${inviteUrl}</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} QRIfy. All rights reserved.</p>
        <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
    </body>
    </html>
  `;
  
  await sendEmail(email, `You're invited to join ${inviterName}'s QRify team`, html);
}
