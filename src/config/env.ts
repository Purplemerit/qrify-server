import "dotenv/config";

export const env = {
  PORT: process.env.PORT || "4000",
  JWT_SECRET: process.env.JWT_SECRET || "changeme",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
};
