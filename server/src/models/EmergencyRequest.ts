import { Schema, model, Model, Document } from 'mongoose';
import {
  IEmergencyRequest,
  BloodGroup,
  BloodComponent,
  RequestUrgency,
  RequestStatus,
  PotentialMatchStatus,
} from '../types';

export interface IEmergencyRequestDocument extends Omit<IEmergencyRequest, '_id'>, Document {}

const potentialMatchEntrySchema = new Schema(
  {
    donorId: {
      type: Schema.Types.ObjectId,
      ref: 'DonorProfile',
      required: true,
    },
    status: {
      type: String,
      enum: ['NOTIFIED', 'ACCEPTED', 'DECLINED'] as PotentialMatchStatus[],
      default: 'NOTIFIED',
    },
    matchScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    distanceKm: {
      type: Number,
      default: 0,
      min: 0,
    },
    notifiedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const emergencyRequestSchema = new Schema<IEmergencyRequestDocument>(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'HospitalProfile',
      required: [true, 'Hospital ID is required'],
      index: true,
    },
    patientIdentifier: {
      type: String,
      required: [true, 'Patient identifier reference is required'],
      trim: true,
      maxlength: [50, 'Patient identifier cannot exceed 50 characters'],
    },
    bloodGroup: {
      type: String,
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as BloodGroup[],
        message: '{VALUE} is not a valid blood group',
      },
      required: [true, 'Blood group is required'],
      index: true,
    },
    bloodComponent: {
      type: String,
      enum: {
        values: ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS'] as BloodComponent[],
        message: '{VALUE} is not a valid blood component',
      },
      default: 'WHOLE_BLOOD',
      required: true,
      index: true,
    },
    unitsRequired: {
      type: Number,
      required: [true, 'Number of blood units required is mandatory'],
      min: [1, 'At least 1 unit must be requested'],
      max: [20, 'Cannot request more than 20 units in a single emergency request'],
    },
    urgency: {
      type: String,
      enum: {
        values: ['CRITICAL', 'HIGH', 'MEDIUM'] as RequestUrgency[],
        message: '{VALUE} is not a valid urgency level',
      },
      required: [true, 'Urgency level is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'MATCHED', 'FULFILLED', 'CANCELLED', 'EXPIRED'] as RequestStatus[],
        message: '{VALUE} is not a valid request status',
      },
      default: 'ACTIVE',
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
        validate: {
          validator: (val: number[]) =>
            Array.isArray(val) &&
            val.length === 2 &&
            val[0] >= -180 &&
            val[0] <= 180 &&
            val[1] >= -90 &&
            val[1] <= 90,
          message: 'Coordinates must be valid [longitude (-180 to 180), latitude (-90 to 90)]',
        },
      },
    },
    requiredWithinHours: {
      type: Number,
      required: [true, 'Required timeframe in hours is required'],
      min: [1, 'Timeframe must be at least 1 hour'],
      max: [72, 'Timeframe cannot exceed 72 hours'],
    },
    potentialMatches: {
      type: [potentialMatchEntrySchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const clean = ret as Record<string, unknown>;
        delete clean.__v;
        return clean;
      },
    },
    toObject: {
      transform(_doc, ret) {
        const clean = ret as Record<string, unknown>;
        delete clean.__v;
        return clean;
      },
    },
  }
);

// Geospatial index for matching radius queries
emergencyRequestSchema.index({ location: '2dsphere' });

// Compound index for filtering active emergency requests
emergencyRequestSchema.index({ status: 1, bloodGroup: 1, urgency: 1 });

export const EmergencyRequest: Model<IEmergencyRequestDocument> = model<IEmergencyRequestDocument>(
  'EmergencyRequest',
  emergencyRequestSchema
);
export default EmergencyRequest;
