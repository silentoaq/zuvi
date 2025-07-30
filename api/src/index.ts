import dotenv from 'dotenv';
dotenv.config();
import { initSolana } from './config/solana';
initSolana();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import NodeCache from 'node-cache';

import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { listingRouter } from './routes/listing';
import { applicationRouter } from './routes/application';
import { leaseRouter } from './routes/lease';
import { paymentRouter } from './routes/payment';
import { disputeRouter } from './routes/dispute';
import { disclosureRouter } from './routes/disclosure';
import { setupWebSocket } from './ws/websocket';
import { errorHandler } from './middleware/errorHandler';
import { authenticateToken } from './middleware/auth';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

export const cache = new NodeCache({ 
  stdTTL: 600,
  checkperiod: 120 
});

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.use('/api/auth', authRouter);

app.use('/api/listings', listingRouter);

app.use('/api/user', authenticateToken, userRouter);
app.use('/api/applications', authenticateToken, applicationRouter);
app.use('/api/leases', authenticateToken, leaseRouter);
app.use('/api/payments', authenticateToken, paymentRouter);
app.use('/api/disputes', authenticateToken, disputeRouter);
app.use('/api/disclosure', authenticateToken, disclosureRouter);

setupWebSocket(wss);

app.use(errorHandler);

const PORT = process.env.PORT || 3002;

server.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});