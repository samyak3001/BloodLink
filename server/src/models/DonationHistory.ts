import { Schema, model, Model, Document } from 'mongoose';
import { IDonationHistory, BloodGroup, BloodComponent } from '../types';

export interface IDonationHistoryDocument extends Omit<IDonationHistory, '_id'>, Document {}

const donationHistorySchema = new Schema<IDonationHistoryDocument>(
  {
    donorId: {
      type: Schema.Types.ObjectId,
      ref: 'DonorProfile',
      required: [true, 'Donor ID is required'],
      index: true,
    },
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: 'HospitalProfile',
      required: [true, 'Hospital ID is required'],
      index: true,
    },
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'EmergencyRequest',
      required: [true, 'Emergency Request ID is required'],
      index: true,
    },
    bloodGroup: {
      type: String,
      enum: {
        values: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as BloodGroup[],
        message: '{VALUE} is not a valid blood group',
      },
      required: [true, 'Blood group is required'],
    },
    bloodComponent: {
      type: String,
      enum: {
        values: ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS'] as BloodComponent[],
        message: '{VALUE} is not a valid blood component',
      },
      default: 'WHOLE_BLOOD',
      required: true,
    },
    unitsDonated: {
      type: Number,
      required: [true, 'Units donated is required'],
      min: [1, 'Donated units must be at least 1'],
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    donationDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    certificateId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
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

// Compound index for querying donor's history chronologically
donationHistorySchema.index({ donorId: 1, donationDate: -1 });

export const DonationHistory: Model<IDonationHistoryDocument> = model<IDonationHistoryDocument>(
  'DonationHistory',
  donationHistorySchema
);
export default DonationHistory;
