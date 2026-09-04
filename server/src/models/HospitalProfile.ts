import { Schema, model, Model, Document } from 'mongoose';
import { IHospitalProfile } from '../types';

export interface IHospitalProfileDocument extends Omit<IHospitalProfile, '_id'>, Document {}

const hospitalProfileSchema = new Schema<IHospitalProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
    },
    hospitalName: {
      type: String,
      required: [true, 'Hospital name is required'],
      trim: true,
      minlength: [2, 'Hospital name must be at least 2 characters'],
      maxlength: [150, 'Hospital name cannot exceed 150 characters'],
      index: true,
    },
    licenseNumber: {
      type: String,
      required: [true, 'Medical facility license number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    emergencyHelpline: {
      type: String,
      required: [true, 'Emergency helpline contact is required'],
      trim: true,
    },
    isVerifiedByAdmin: {
      type: Boolean,
      default: false,
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
    address: {
      street: { type: String, required: [true, 'Street address is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, required: [true, 'State is required'], trim: true },
      postalCode: { type: String, required: [true, 'Postal code is required'], trim: true },
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

// Geospatial 2dsphere index for locating hospitals
hospitalProfileSchema.index({ location: '2dsphere' });

export const HospitalProfile: Model<IHospitalProfileDocument> = model<IHospitalProfileDocument>(
  'HospitalProfile',
  hospitalProfileSchema
);
export default HospitalProfile;
