import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger.ts';
import attestationRoutes from './routes/attestation.ts';
import propertiesRoutes from './routes/properties.ts';
import priceRoutes from './routes/price.ts';

dotenv.config();

const app = express();
const logger = createLogger();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://zuvi.ddns.net' 
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    program: process.env.ZUVI_PROGRAM_ID
  });
});

// 路由
app.use('/api/attestation', attestationRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/price', priceRoutes);

// 錯誤處理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});