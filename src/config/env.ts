import "dotenv/config";

export const env = {
  PORT: process.env.PORT || "4000",
  JWT_SECRET: process.env.JWT_SECRET || "changeme",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:8080",
  NODE_ENV: process.env.NODE_ENV || "development",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET_HERE",
  EMAIL_USER: process.env.EMAIL_USER || "purplemerit9@gmail.com",
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "bkpgbencidbbpdwg",
  EMAIL_FROM: process.env.EMAIL_FROM || "purplemerit9@gmail.com",
};
