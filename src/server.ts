import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import qrRoutes from './routes/qr.js';
import scanRoutes from './routes/scan.js';
import templateRoutes from './routes/template.js';
import contactRoutes from './routes/contact.js';
import usersRoutes from './routes/users.js';

const app = express();

app.use(helmet());

// CORS configuration with support for multiple origins
const allowedOrigins = env.CLIENT_URL.split(',').map(origin => origin.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Enable cookies
}));
app.use(cookieParser()); // Parse cookies
app.use(express.json({ limit: '2mb' }));

// Root endpoint
app.get('/', (_req, res) => {
  res.json({ 
    message: 'QRify API Server', 
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth',
      qr: '/qr',
      templates: '/templates',
      scan: '/scan',
      contact: '/contact',
      users: '/users'
    }
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/qr', qrRoutes);
app.use('/templates', templateRoutes);
app.use('/scan', scanRoutes); // public
app.use('/contact', contactRoutes); // public
app.use('/users', usersRoutes);

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});
