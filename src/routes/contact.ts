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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contact Form Submission</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                      📩 New Contact Request
                    </h1>
                    <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                      Someone needs your attention
                    </p>
                  </td>
                </tr>
                
                <!-- Priority Badge -->
                <tr>
                  <td style="padding: 30px 30px 20px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <span style="display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; background-color: ${priority === 'urgent' ? '#ef4444' : priority === 'high' ? '#f97316' : priority === 'medium' ? '#eab308' : '#22c55e'}; color: #ffffff; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);">
                        ${priorityMap[priority]} Priority
                      </span>
                    </div>
                  </td>
                </tr>
                
                <!-- Contact Details -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
                      <tr style="background-color: #f9fafb;">
                        <td style="padding: 16px 20px; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 1px solid #e5e7eb; width: 140px;">
                          👤 Name
                        </td>
                        <td style="padding: 16px 20px; color: #1f2937; font-size: 14px; border-bottom: 1px solid #e5e7eb;">
                          ${firstName} ${lastName}
                        </td>
                      </tr>
                      <tr style="background-color: #ffffff;">
                        <td style="padding: 16px 20px; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 1px solid #e5e7eb;">
                          ✉️ Email
                        </td>
                        <td style="padding: 16px 20px; color: #1f2937; font-size: 14px; border-bottom: 1px solid #e5e7eb;">
                          <a href="mailto:${email}" style="color: #667eea; text-decoration: none; font-weight: 500;">${email}</a>
                        </td>
                      </tr>
                      <tr style="background-color: #f9fafb;">
                        <td style="padding: 16px 20px; font-weight: 600; color: #374151; font-size: 14px; border-bottom: 1px solid #e5e7eb;">
                          📋 Subject
                        </td>
                        <td style="padding: 16px 20px; color: #1f2937; font-size: 14px; border-bottom: 1px solid #e5e7eb;">
                          ${subjectMap[subject]}
                        </td>
                      </tr>
                      <tr style="background-color: #ffffff;">
                        <td style="padding: 16px 20px; font-weight: 600; color: #374151; font-size: 14px;">
                          📅 Received
                        </td>
                        <td style="padding: 16px 20px; color: #1f2937; font-size: 14px;">
                          ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Message -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <h2 style="margin: 0 0 16px; font-size: 18px; color: #1f2937; font-weight: 600;">
                      💬 Message
                    </h2>
                    <div style="background: linear-gradient(to right, #667eea, #764ba2); padding: 2px; border-radius: 12px;">
                      <div style="background-color: #ffffff; padding: 20px; border-radius: 10px;">
                        <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                      </div>
                    </div>
                  </td>
                </tr>
                
                <!-- Action Button -->
                <tr>
                  <td style="padding: 0 30px 40px; text-align: center;">
                    <a href="mailto:${email}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); transition: all 0.3s;">
                      Reply to ${firstName} →
                    </a>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                      This is an automated message from QRIfy Contact Form<br>
                      © ${new Date().getFullYear()} QRIfy. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>We Received Your Message</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 30px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                      Thank You for Reaching Out!
                    </h1>
                    <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 14px;">
                      Your message has been received
                    </p>
                  </td>
                </tr>
                
                <!-- Greeting -->
                <tr>
                  <td style="padding: 40px 30px 30px;">
                    <h2 style="margin: 0 0 16px; font-size: 22px; color: #1f2937; font-weight: 600;">
                      Hi ${firstName} 👋
                    </h2>
                    <p style="margin: 0 0 16px; color: #374151; font-size: 15px; line-height: 1.6;">
                      Thank you for contacting QRIfy support! We've successfully received your message and appreciate you taking the time to reach out to us.
                    </p>
                    <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                      Our support team is reviewing your <strong>${subjectMap[subject].toLowerCase()}</strong> request and will get back to you as soon as possible.
                    </p>
                  </td>
                </tr>
                
                <!-- Response Time Card -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <div style="background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border: 2px solid #667eea30; border-radius: 12px; padding: 24px; text-align: center;">
                      <div style="font-size: 32px; margin-bottom: 12px;">⏱️</div>
                      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Expected Response Time
                      </p>
                      <p style="margin: 0; font-size: 24px; color: #667eea; font-weight: bold;">
                        ${priority === 'urgent' ? '2-4 hours' : priority === 'high' ? '4-8 hours' : priority === 'medium' ? '1-2 days' : '3-5 days'}
                      </p>
                      <p style="margin: 12px 0 0; font-size: 12px; color: #6b7280;">
                        Based on ${priorityMap[priority]} priority
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- What's Next -->
                <tr>
                  <td style="padding: 0 30px 30px;">
                    <h3 style="margin: 0 0 16px; font-size: 18px; color: #1f2937; font-weight: 600;">
                      📌 What happens next?
                    </h3>
                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding: 12px 0;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td width="30" valign="top">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #667eea; color: #ffffff; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">1</div>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
                                  Our team reviews your message
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td width="30" valign="top">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #667eea; color: #ffffff; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">2</div>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
                                  We investigate and prepare a solution
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0;">
                          <table cellpadding="0" cellspacing="0" border="0" width="100%">
                            <tr>
                              <td width="30" valign="top">
                                <div style="width: 24px; height: 24px; border-radius: 50%; background-color: #667eea; color: #ffffff; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold;">3</div>
                              </td>
                              <td style="padding-left: 12px;">
                                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.5;">
                                  You receive a personalized response
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Help Section -->
                <tr>
                  <td style="padding: 0 30px 40px;">
                    <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; border-left: 4px solid #667eea;">
                      <p style="margin: 0 0 12px; color: #374151; font-size: 14px; line-height: 1.6;">
                        <strong>💡 In the meantime:</strong>
                      </p>
                      <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.5;">
                        • Check our FAQ section for instant answers
                      </p>
                      <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.5;">
                        • Browse our documentation for detailed guides
                      </p>
                      <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                        • Reply to this email to add more information
                      </p>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center;">
                    <p style="margin: 0 0 8px; color: #374151; font-size: 14px; font-weight: 600;">
                      Need urgent help?
                    </p>
                    <p style="margin: 0 0 16px; color: #6b7280; font-size: 12px; line-height: 1.5;">
                      You can always reply to this email with additional details
                    </p>
                    <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                      © ${new Date().getFullYear()} QRIfy. All rights reserved.<br>
                      This is an automated confirmation email
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
