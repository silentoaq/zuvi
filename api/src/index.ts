import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import NodeCache from 'node-cache';

import { authRouter } from './routes/auth';
import { listingRouter } from './routes/listing';
import { applicationRouter } from './routes/application';
import { leaseRouter } from './routes/lease';
import { paymentRouter } from './routes/payment';
import { disputeRouter } from './routes/dispute';
import { setupWebSocket } from './ws/websocket';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// 全域緩存
export const cache = new NodeCache({ 
  stdTTL: 600, // 10分鐘預設
  checkperiod: 120 
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// 公開路由
app.use('/api/auth', authRouter);

// 需認證的路由
app.use('/api/listings', authenticateToken, listingRouter);
app.use('/api/applications', authenticateToken, applicationRouter);
app.use('/api/leases', authenticateToken, leaseRouter);
app.use('/api/payments', authenticateToken, paymentRouter);
app.use('/api/disputes', authenticateToken, disputeRouter);

// WebSocket
setupWebSocket(wss);

// 錯誤處理
app.use(errorHandler);

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});