/**
 * Socket.IO event type definitions shared across the server codebase.
 * Defines the strict contract for all real-time events emitted and received.
 */

// -------------------------------------------------------------------
// Server → Client Events
// -------------------------------------------------------------------
export interface EmergencyAlertPayload {
  requestId: string;
  bloodGroup: string;
  bloodComponent: string;
  unitsRequired: number;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  hospitalName: string;
  distanceKm: number;
  distanceFormatted: string;
  estimatedTransitTimeMinutes: number;
  matchScore: number;
  matchReasons: string[];
  address: { city: string; district: string; postalCode: string };
  notificationId?: string;
  // NOTE: Exact GPS coordinates are NEVER included in this payload
}

export interface DonorResponsePayload {
  requestId: string;
  donorId: string;
  donorBloodGroup: string;
  action: 'ACCEPTED' | 'DECLINED';
  requestStatus: string;
  totalAccepted: number;
  unitsRequired: number;
  timestamp: string;
}

export interface RequestUpdatedPayload {
  requestId: string;
  previousStatus: string;
  newStatus: string;
  bloodGroup: string;
  urgency: string;
  updatedBy: 'hospital' | 'donor' | 'admin' | 'system';
  timestamp: string;
}

export interface NotificationCountPayload {
  unreadCount: number;
}

export interface ServerToClientEvents {
  'emergency:alert': (data: EmergencyAlertPayload) => void;
  'donor:response': (data: DonorResponsePayload) => void;
  'request:updated': (data: RequestUpdatedPayload) => void;
  'notification:unread-count': (data: NotificationCountPayload) => void;
  'connection:error': (data: { message: string }) => void;
}

// -------------------------------------------------------------------
// Client → Server Events
// -------------------------------------------------------------------
export interface ClientToServerEvents {
  'request:subscribe': (requestId: string) => void;
  'request:unsubscribe': (requestId: string) => void;
  ping: () => void;
}

// -------------------------------------------------------------------
// Internal Inter-Server Events
// -------------------------------------------------------------------
export interface InterServerEvents {
  ping: () => void;
}

// -------------------------------------------------------------------
// Per-socket data (attached after JWT authentication)
// -------------------------------------------------------------------
export interface SocketData {
  userId: string;
  role: 'DONOR' | 'HOSPITAL' | 'ADMIN';
  email: string;
}
