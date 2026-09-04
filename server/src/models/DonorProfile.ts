import { Schema, model, Model, Document } from 'mongoose';
import { IDonorProfile, ISafeDonorProfile, BloodGroup, BloodComponent } from '../types';

export interface IDonorProfileDocument extends Omit<IDonorProfile, '_id'>, Document {
  toSafeProfile(distanceKm?: number, matchScore?: number): ISafeDonorProfile;
}

const selfReportedScreeningSchema = new Schema(
  {
    isAgeEligible: {
      type: Boolean,
      default: false,
      description: 'Self-reported age between 18 and 65 years',
    },
    isWeightEligible: {
      type: Boolean,
      default: false,
      description: 'Self-reported weight of at least 50 kg',
    },
    hasNoRecentIllness: {
      type: Boolean,
      default: true,
      description: 'Self-reported absence of fever, active infection, or recent illness',
    },
    hasValidInterval: {
      type: Boolean,
      default: true,
      description: 'Self-reported adherence to mandatory donation intervals',
    },
    screeningDisclaimerAcknowledged: {
      type: Boolean,
      default: false,
      description: 'Acknowledges that self-reported screening is NOT medical clearance',
    },
    lastScreeningDate: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const donorProfileSchema = new Schema<IDonorProfileDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true,
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
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    supportedComponents: {
      type: [String],
      enum: {
        values: ['WHOLE_BLOOD', 'RED_CELLS', 'PLASMA', 'PLATELETS'] as BloodComponent[],
        message: '{VALUE} is not a valid blood component',
      },
      default: ['WHOLE_BLOOD'],
      required: true,
    },
    selfReportedScreening: {
      type: selfReportedScreeningSchema,
      default: () => ({}),
    },
    lastDonationDate: {
      type: Date,
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
      city: { type: String, required: [true, 'City is required'], trim: true },
      district: { type: String, required: [true, 'District is required'], trim: true },
      postalCode: { type: String, required: [true, 'Postal code is required'], trim: true },
    },
    privacySettings: {
      hideExactLocation: { type: Boolean, default: true },
      showContactToMatchedHospitalsOnly: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const clean = ret as Record<string, unknown>;
        // Privacy enforcement: mask exact GPS coordinates in default JSON serialization
        if (clean.privacySettings && typeof clean.privacySettings === 'object' && (clean.privacySettings as Record<string, unknown>).hideExactLocation !== false) {
          delete clean.location;
        }
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

// Geospatial 2dsphere index for proximity matching
donorProfileSchema.index({ location: '2dsphere' });

// Compound index for matching queries (available donors by blood group)
donorProfileSchema.index({ isAvailable: 1, bloodGroup: 1 });

// Method to generate a safe potential match projection without sensitive GPS data
donorProfileSchema.methods.toSafeProfile = function (
  distanceKm?: number,
  matchScore?: number
): ISafeDonorProfile {
  return {
    _id: this._id.toString(),
    userId: this.userId,
    bloodGroup: this.bloodGroup,
    isAvailable: this.isAvailable,
    supportedComponents: this.supportedComponents,
    address: {
      city: this.address.city,
      district: this.address.district,
      postalCode: this.address.postalCode,
    },
    distanceKm: distanceKm !== undefined ? Math.round(distanceKm * 10) / 10 : undefined,
    matchScore,
  };
};

export const DonorProfile: Model<IDonorProfileDocument> = model<IDonorProfileDocument>(
  'DonorProfile',
  donorProfileSchema
);
export default DonorProfile;
