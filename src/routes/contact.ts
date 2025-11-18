import { Router } from 'express';
import { z } from 'zod';
import { sendEmail } from '../lib/email.js';
import { env } from '../config/env.js';

const router = Router();

// Contact form schema validation
const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  subject: z.enum(['technical', 'billing', 'feature', 'bug', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, subject, priority, message } = contactSchema.parse(req.body);

    // Map subject values to readable text
    const subjectMap: Record<string, string> = {
      technical: 'Technical Support',
      billing: 'Billing Question',
      feature: 'Feature Request',
      bug: 'Bug Report',
      other: 'Other',
    };

    // Map priority values to readable text
    const priorityMap: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      urgent: 'Urgent',
    };

    const emailSubject = `[${priorityMap[priority]}] Contact Form: ${subjectMap[subject]}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Contact Form Submission</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">New Contact Form Submission</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Contact Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold; width: 150px;">Name:</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${firstName} ${lastName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${email}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Subject:</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subjectMap[subject]}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Priority:</td>
              <td style="padding: 10px; border-bottom: 1px solid #ddd;">
                <span style="background: ${priority === 'urgent' ? '#ef4444' : priority === 'high' ? '#f97316' : priority === 'medium' ? '#eab308' : '#22c55e'}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                  ${priorityMap[priority]}
                </span>
              </td>
            </tr>
          </table>
          
          <h2 style="color: #333; margin-top: 30px;">Message</h2>
          <div style="background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea;">
            ${message.replace(/\n/g, '<br>')}
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            <strong>Reply to:</strong> ${email}
          </p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} QRIfy. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    // Send email to support email
    await sendEmail('purplemerit9@gmail.com', emailSubject, html);

    // Send confirmation email to user
    const confirmationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>We Received Your Message</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Thank You for Contacting Us!</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Hi ${firstName},</h2>
          <p>We've received your message and appreciate you taking the time to contact us.</p>
          <p>Our support team will review your ${subjectMap[subject].toLowerCase()} request and get back to you as soon as possible.</p>
          
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
            <p style="margin: 0; font-weight: bold;">Expected Response Time:</p>
            <p style="margin: 5px 0 0 0;">
              ${priority === 'urgent' ? '2-4 hours' : priority === 'high' ? '4-8 hours' : priority === 'medium' ? '1-2 days' : '3-5 days'}
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px;">In the meantime, you might find our FAQ or documentation helpful.</p>
          <p style="color: #666; font-size: 14px;">If you have any additional information to add to your request, please reply to this email.</p>
        </div>
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} QRIfy. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail(email, 'We Received Your Message - QRIfy', confirmationHtml);

    res.status(200).json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
