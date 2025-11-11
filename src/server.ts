import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import authRoutes from './routes/auth';
import qrRoutes from './routes/qr';
import scanRoutes from './routes/scan';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/qr', qrRoutes);
app.use('/scan', scanRoutes); // public

app.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
});
