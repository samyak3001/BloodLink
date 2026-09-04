// BloodLink Core Frontend Type Definitions

export type UserRole = 'DONOR' | 'HOSPITAL' | 'ADMIN';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type BloodComponent = 'WHOLE_BLOOD' | 'RED_CELLS' | 'PLASMA' | 'PLATELETS';

export type RequestUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM';

export type RequestStatus = 'ACTIVE' | 'MATCHED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

export interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  version: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  isVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  status: string;
  message?: string;
  token?: string;
  user?: AuthUser;
  profile?: Record<string, unknown> | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: 'DONOR' | 'HOSPITAL';
  phone: string;
  // Donor
  bloodGroup?: BloodGroup;
  supportedComponents?: BloodComponent[];
  city?: string;
  district?: string;
  postalCode?: string;
  coordinates?: [number, number];
  selfReportedScreening?: {
    isAgeEligible?: boolean;
    isWeightEligible?: boolean;
    hasNoRecentIllness?: boolean;
    hasValidInterval?: boolean;
    screeningDisclaimerAcknowledged?: boolean;
  };
  // Hospital
  hospitalName?: string;
  licenseNumber?: string;
  emergencyHelpline?: string;
  street?: string;
  state?: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  newPassword: string;
}

export interface Notification {
  _id: string;
  recipientId: string;
  type: 'EMERGENCY_ALERT' | 'DONOR_ACCEPTED' | 'DONOR_DECLINED' | 'STATUS_UPDATE' | 'SYSTEM';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}
