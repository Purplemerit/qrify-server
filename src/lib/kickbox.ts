import axios from 'axios';
import { env } from '../config/env.js';

export interface KickboxVerificationResult {
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
  reason: string;
  role: boolean;
  free: boolean;
  disposable: boolean;
  accept_all: boolean;
  did_you_mean: string | null;
  sendex: number;
  email: string;
  user: string;
  domain: string;
  success: boolean;
  message?: string;
}

/**
 * Verify an email address using Kickbox API
 * @param email The email address to verify
 * @returns Verification result from Kickbox
 */
export async function verifyEmailWithKickbox(
  email: string
): Promise<KickboxVerificationResult> {
  try {
    // Check if API key is configured
    if (!env.KICKBOX_API_KEY || env.KICKBOX_API_KEY === 'your_kickbox_api_key_here') {
      console.warn('Kickbox API key not configured - skipping email verification');
      return {
        result: 'unknown',
        reason: 'api_key_not_configured',
        role: false,
        free: false,
        disposable: false,
        accept_all: false,
        did_you_mean: null,
        sendex: 0,
        email: email,
        user: email.split('@')[0],
        domain: email.split('@')[1] || '',
        success: false,
        message: 'Email verification not configured',
      };
    }

    const response = await axios.get<KickboxVerificationResult>(
      `https://api.kickbox.com/v2/verify`,
      {
        params: {
          email: email,
          apikey: env.KICKBOX_API_KEY,
        },
        timeout: 10000, // 10 second timeout
      }
    );

    return response.data;
  } catch (error: any) {
    console.error('Kickbox verification error:', error.message);
    
    // Log more details for 403 errors (invalid API key)
    if (error.response?.status === 403) {
      console.error('Kickbox API key may be invalid or expired. Please check your API key at https://kickbox.com/app/settings');
    } else if (error.response?.status === 429) {
      console.error('Kickbox API rate limit exceeded');
    }
    
    // If Kickbox API fails, we'll allow the signup to continue
    // but log the error for monitoring
    return {
      result: 'unknown',
      reason: 'api_error',
      role: false,
      free: false,
      disposable: false,
      accept_all: false,
      did_you_mean: null,
      sendex: 0,
      email: email,
      user: email.split('@')[0],
      domain: email.split('@')[1] || '',
      success: false,
      message: 'Email verification service temporarily unavailable',
    };
  }
}

/**
 * Check if an email verification result is acceptable for signup
 * @param result The Kickbox verification result
 * @returns Object with isValid flag and error message if invalid
 */
export function isEmailAcceptable(result: KickboxVerificationResult): {
  isValid: boolean;
  message?: string;
  suggestion?: string;
} {
  // If API call failed, allow signup to continue
  if (!result.success && result.message) {
    return { isValid: true };
  }

  // Block disposable/temporary email addresses
  if (result.disposable) {
    return {
      isValid: false,
      message: 'Disposable email addresses are not allowed. Please use a permanent email address.',
    };
  }

  // Block undeliverable emails
  if (result.result === 'undeliverable') {
    return {
      isValid: false,
      message: 'This email address appears to be invalid or undeliverable.',
      suggestion: result.did_you_mean || undefined,
    };
  }

  // Warn about risky emails but allow them
  if (result.result === 'risky') {
    console.warn(`Risky email signup attempt: ${result.email} - ${result.reason}`);
    // Allow risky emails but log for monitoring
    return { isValid: true };
  }

  // Allow deliverable and unknown emails
  return { isValid: true };
}
