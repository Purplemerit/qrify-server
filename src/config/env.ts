import "dotenv/config";

export const env = {
  PORT: process.env.PORT!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN!,
  CLIENT_URL: process.env.CLIENT_URL!,
  NODE_ENV: process.env.NODE_ENV!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  EMAIL_USER: process.env.EMAIL_USER!,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD!,
  EMAIL_FROM: process.env.EMAIL_FROM!,
  KICKBOX_API_KEY: process.env.KICKBOX_API_KEY!,
};

// Validate Google OAuth configuration
if (!env.GOOGLE_CLIENT_ID && env.NODE_ENV === 'production') {
  console.warn('Warning: Google OAuth Client ID not configured for production');
}

if (!env.GOOGLE_CLIENT_SECRET && env.NODE_ENV === 'production') {
  console.warn('Warning: Google OAuth Client Secret not configured for production');
}
