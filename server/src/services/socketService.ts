import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { Notification } from '../models';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  EmergencyAlertPayload,
  DonorResponsePayload,
  RequestUpdatedPayload,
} from '../types/socket';

export type BloodLinkSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type BloodLinkIO = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: BloodLinkIO | null = null;

/**
 * Initialize the Socket.IO server attached to the HTTP server.
 * Configures CORS, JWT authentication middleware, room assignment,
 * and all real-time event listeners.
 */
export function initSocketIO(httpServer: HttpServer): BloodLinkIO {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

  io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // -------------------------------------------------------------------
  // JWT Authentication Middleware
  // Validates the Bearer token sent in auth.token during handshake
  // -------------------------------------------------------------------
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        // Allow unauthenticated guest connections for real-time status and public rooms
        return next();
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Authentication failed: Invalid or expired token'));
      }

      // Attach verified identity to socket data
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role as 'DONOR' | 'HOSPITAL' | 'ADMIN';
      socket.data.email = decoded.email;

      next();
    } catch (err) {
      next(new Error('Authentication failed: Token verification error'));
    }
  });

  // -------------------------------------------------------------------
  // Connection handler: assign rooms and wire listeners
  // -------------------------------------------------------------------
  io.on('connection', async (socket: BloodLinkSocket) => {
    const { userId, role } = socket.data;

    if (userId && role) {
      console.log(`[Socket.IO] Connected: userId=${userId} role=${role} socketId=${socket.id}`);

      // 1. Join personal user room
      await socket.join(`user:${userId}`);

      // 2. Join role-based broadcast rooms
      await socket.join(`role:${role.toLowerCase()}s`); // role:donors | role:hospitals | role:admins

      // 3. Send current unread count on connection
      try {
        const unreadCount = await Notification.countDocuments({
          recipientId: userId,
          isRead: false,
        });
        socket.emit('notification:unread-count', { unreadCount });
      } catch {
        // Non-fatal: proceed if DB unavailable (e.g. tests)
      }
    } else {
      console.log(`[Socket.IO] Connected guest: socketId=${socket.id}`);
    }

    // 4. Subscribe to a specific emergency request room
    socket.on('request:subscribe', async (requestId: string) => {
      if (typeof requestId === 'string' && requestId.length > 0) {
        await socket.join(`request:${requestId}`);
        console.log(`[Socket.IO] Socket ${socket.id} subscribed to request:${requestId}`);
      }
    });

    // 5. Unsubscribe from a specific emergency request room
    socket.on('request:unsubscribe', async (requestId: string) => {
      if (typeof requestId === 'string' && requestId.length > 0) {
        await socket.leave(`request:${requestId}`);
        console.log(`[Socket.IO] Socket ${socket.id} unsubscribed from request:${requestId}`);
      }
    });

    // 6. Ping / liveness check
    socket.on('ping', () => {
      socket.emit('connection:error', { message: 'pong' }); // reuse error channel for pong
    });

    // 7. Disconnection cleanup
    socket.on('disconnect', (reason) => {
      console.log(
        `[Socket.IO] Disconnected: userId=${userId} socketId=${socket.id} reason=${reason}`
      );
    });
  });

  console.log('[Socket.IO] Server initialized');
  return io;
}

/**
 * Get the active Socket.IO instance. Throws if not initialized.
 */
export function getIO(): BloodLinkIO {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocketIO() first.');
  }
  return io;
}

// -------------------------------------------------------------------
// Emission Helpers — Used by Phase 5 controllers for real-time push
// -------------------------------------------------------------------

/**
 * Emit emergency:alert to a specific donor's personal room.
 * NEVER includes raw GPS coordinates.
 */
export function emitEmergencyAlert(donorUserId: string, payload: EmergencyAlertPayload): void {
  if (!io) return;
  io.to(`user:${donorUserId}`).emit('emergency:alert', payload);
}

/**
 * Broadcast emergency:alert to the role:donors room.
 * Used for general announcements when individual donor targeting is not required.
 */
export function broadcastEmergencyAlertToDonors(payload: EmergencyAlertPayload): void {
  if (!io) return;
  io.to('role:donors').emit('emergency:alert', payload);
}

/**
 * Emit donor:response to the requesting hospital's personal room.
 */
export function emitDonorResponse(hospitalUserId: string, payload: DonorResponsePayload): void {
  if (!io) return;
  io.to(`user:${hospitalUserId}`).emit('donor:response', payload);
}

/**
 * Emit request:updated to all subscribers of a specific request room.
 */
export function emitRequestUpdated(requestId: string, payload: RequestUpdatedPayload): void {
  if (!io) return;
  io.to(`request:${requestId}`).emit('request:updated', payload);
}

/**
 * Refresh the unread notification count badge for a user.
 */
export async function pushUnreadCount(userId: string): Promise<void> {
  if (!io) return;
  try {
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
    });
    io.to(`user:${userId}`).emit('notification:unread-count', { unreadCount });
  } catch {
    // Non-fatal
  }
}
