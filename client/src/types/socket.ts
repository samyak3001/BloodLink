/**
 * Socket.IO event type definitions for the client.
 * Matches the server-side definitions.
 */

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

export interface ClientToServerEvents {
  'request:subscribe': (requestId: string) => void;
  'request:unsubscribe': (requestId: string) => void;
  ping: () => void;
}
