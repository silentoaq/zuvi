import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { PublicKey } from '@solana/web3.js';
import { connection, program } from '../config/solana';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

const clients = new Map<string, AuthenticatedWebSocket>();

export function setupWebSocket(wss: WebSocketServer) {
  // 心跳檢測
  const interval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'auth':
            handleAuth(ws, data.token);
            break;

          case 'subscribe':
            if (!ws.userId) {
              ws.send(JSON.stringify({ error: 'Not authenticated' }));
              return;
            }
            handleSubscribe(ws, data);
            break;

          case 'unsubscribe':
            handleUnsubscribe(ws, data);
            break;

          default:
            ws.send(JSON.stringify({ error: 'Unknown message type' }));
        }
      } catch (error) {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}

function handleAuth(ws: AuthenticatedWebSocket, token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    ws.userId = decoded.publicKey;
    
    clients.set(ws.userId!, ws);
    
    ws.send(JSON.stringify({
      type: 'auth_success',
      userId: ws.userId
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'auth_error',
      error: 'Invalid token'
    }));
  }
}

async function handleSubscribe(ws: AuthenticatedWebSocket, data: any) {
  const { resource, id } = data;

  switch (resource) {
    case 'listing':
      subscribeListing(ws, id);
      break;

    case 'application':
      subscribeApplication(ws, id);
      break;

    case 'lease':
      subscribeLease(ws, id);
      break;

    case 'dispute':
      subscribeDispute(ws, id);
      break;

    default:
      ws.send(JSON.stringify({ error: 'Unknown resource type' }));
  }
}

function handleUnsubscribe(ws: AuthenticatedWebSocket, data: any) {
  ws.send(JSON.stringify({
    type: 'unsubscribed',
    resource: data.resource,
    id: data.id
  }));
}

// 訂閱房源更新
function subscribeListing(ws: AuthenticatedWebSocket, listingId: string) {
  try {
    const listingPubkey = new PublicKey(listingId);
    
    const subscriptionId = connection.onAccountChange(
      listingPubkey,
      async (accountInfo) => {
        try {
          const listing = program.coder.accounts.decode('listing', accountInfo.data);
          
          ws.send(JSON.stringify({
            type: 'listing_update',
            id: listingId,
            data: {
              status: listing.status,
              currentTenant: listing.currentTenant?.toString() || null
            }
          }));
        } catch (error) {
          console.error('Error decoding listing:', error);
        }
      }
    );

    ws.send(JSON.stringify({
      type: 'subscribed',
      resource: 'listing',
      id: listingId,
      subscriptionId
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'subscribe_error',
      error: 'Failed to subscribe to listing'
    }));
  }
}

// 訂閱申請更新
function subscribeApplication(ws: AuthenticatedWebSocket, applicationId: string) {
  try {
    const applicationPubkey = new PublicKey(applicationId);
    
    const subscriptionId = connection.onAccountChange(
      applicationPubkey,
      async (accountInfo) => {
        try {
          const application = program.coder.accounts.decode('application', accountInfo.data);
          
          ws.send(JSON.stringify({
            type: 'application_update',
            id: applicationId,
            data: {
              status: application.status
            }
          }));
        } catch (error) {
          console.error('Error decoding application:', error);
        }
      }
    );

    ws.send(JSON.stringify({
      type: 'subscribed',
      resource: 'application',
      id: applicationId,
      subscriptionId
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'subscribe_error',
      error: 'Failed to subscribe to application'
    }));
  }
}

// 訂閱租約更新
function subscribeLease(ws: AuthenticatedWebSocket, leaseId: string) {
  try {
    const leasePubkey = new PublicKey(leaseId);
    
    const subscriptionId = connection.onAccountChange(
      leasePubkey,
      async (accountInfo) => {
        try {
          const lease = program.coder.accounts.decode('lease', accountInfo.data);
          
          ws.send(JSON.stringify({
            type: 'lease_update',
            id: leaseId,
            data: {
              status: lease.status,
              paidMonths: lease.paidMonths,
              landlordSigned: lease.landlordSigned,
              tenantSigned: lease.tenantSigned
            }
          }));
        } catch (error) {
          console.error('Error decoding lease:', error);
        }
      }
    );

    ws.send(JSON.stringify({
      type: 'subscribed',
      resource: 'lease',
      id: leaseId,
      subscriptionId
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'subscribe_error',
      error: 'Failed to subscribe to lease'
    }));
  }
}

// 訂閱爭議更新
function subscribeDispute(ws: AuthenticatedWebSocket, disputeId: string) {
  try {
    const disputePubkey = new PublicKey(disputeId);
    
    const subscriptionId = connection.onAccountChange(
      disputePubkey,
      async (accountInfo) => {
        try {
          const dispute = program.coder.accounts.decode('dispute', accountInfo.data);
          
          ws.send(JSON.stringify({
            type: 'dispute_update',
            id: disputeId,
            data: {
              status: dispute.status
            }
          }));
        } catch (error) {
          console.error('Error decoding dispute:', error);
        }
      }
    );

    ws.send(JSON.stringify({
      type: 'subscribed',
      resource: 'dispute',
      id: disputeId,
      subscriptionId
    }));
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'subscribe_error',
      error: 'Failed to subscribe to dispute'
    }));
  }
}

// 廣播訊息給特定用戶
export function broadcastToUser(userId: string, message: any) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

// 廣播訊息給所有用戶
export function broadcastToAll(message: any) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}