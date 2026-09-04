import { Types } from 'mongoose';

// User Roles
export type UserRole = 'DONOR' | 'HOSPITAL' | 'ADMIN';

// Blood Group Types
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

// Blood Component Types
export type BloodComponent = 'WHOLE_BLOOD' | 'RED_CELLS' | 'PLASMA' | 'PLATELETS';

// Urgency Levels
export type RequestUrgency = 'CRITICAL' | 'HIGH' | 'MEDIUM';

// Emergency Request Statuses
export type RequestStatus = 'ACTIVE' | 'MATCHED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';

// Potential Match Statuses
export type PotentialMatchStatus = 'NOTIFIED' | 'ACCEPTED' | 'DECLINED';

// GeoJSON Point
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// JWT Token Payload
export interface AuthTokenPayload {
  userId: string;
  role: UserRole;
  email: string;
}

// Safe User (Excludes sensitive hashes and tokens)
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  isVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

// Extend Express Request interface globally
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

// User Document Interface
export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  isVerified: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  passwordResetHash?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Self-Reported Screening (Not medical clearance)
export interface ISelfReportedScreening {
  isAgeEligible: boolean; // self-reported 18-65
  isWeightEligible: boolean; // self-reported >= 50kg
  hasNoRecentIllness: boolean;
  hasValidInterval: boolean;
  screeningDisclaimerAcknowledged: boolean;
  lastScreeningDate: Date;
}

// Donor Profile Document Interface
export interface IDonorProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId | IUser;
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  supportedComponents: BloodComponent[];
  selfReportedScreening: ISelfReportedScreening;
  lastDonationDate?: Date;
  location: GeoJSONPoint;
  address: {
    city: string;
    district: string;
    postalCode: string;
  };
  privacySettings: {
    hideExactLocation: boolean;
    showContactToMatchedHospitalsOnly: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Safe Donor Projection (Exact coordinates and private PII masked for security & privacy)
export interface ISafeDonorProfile {
  _id: string;
  userId: string | { _id: string; name: string; role: UserRole };
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  supportedComponents: BloodComponent[];
  address: {
    city: string;
    district: string;
    postalCode: string;
  };
  distanceKm?: number;
  matchScore?: number;
}

// Hospital Profile Document Interface
export interface IHospitalProfile {
  _id: Types.ObjectId;
  userId: Types.ObjectId | IUser;
  hospitalName: string;
  licenseNumber: string;
  emergencyHelpline: string;
  isVerifiedByAdmin: boolean;
  location: GeoJSONPoint;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Potential Match Entry inside Emergency Request
export interface IPotentialMatchEntry {
  donorId: Types.ObjectId | IDonorProfile;
  status: PotentialMatchStatus;
  matchScore: number;
  distanceKm: number;
  notifiedAt: Date;
  respondedAt?: Date;
}

// Emergency Request Document Interface
export interface IEmergencyRequest {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId | IHospitalProfile;
  patientIdentifier: string;
  bloodGroup: BloodGroup;
  bloodComponent: BloodComponent;
  unitsRequired: number;
  urgency: RequestUrgency;
  status: RequestStatus;
  location: GeoJSONPoint;
  requiredWithinHours: number;
  potentialMatches: IPotentialMatchEntry[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Donation History Document Interface
export interface IDonationHistory {
  _id: Types.ObjectId;
  donorId: Types.ObjectId | IDonorProfile;
  hospitalId: Types.ObjectId | IHospitalProfile;
  requestId: Types.ObjectId | IEmergencyRequest;
  bloodGroup: BloodGroup;
  bloodComponent: BloodComponent;
  unitsDonated: number;
  status: 'COMPLETED' | 'CANCELLED';
  donationDate: Date;
  certificateId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Document Interface
export interface INotification {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId | IUser;
  type: 'EMERGENCY_ALERT' | 'DONOR_ACCEPTED' | 'DONOR_DECLINED' | 'STATUS_UPDATE' | 'SYSTEM';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Audit Log Document Interface
export interface IAuditLog {
  _id: Types.ObjectId;
  actorId: Types.ObjectId | IUser;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}
