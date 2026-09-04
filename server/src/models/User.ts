import { Schema, model, Model, Document } from 'mongoose';
import { IUser, UserRole } from '../types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  toSafeObject(): Record<string, unknown>;
}

const userSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: true, // Included by default in internal queries, but stripped on serialization
    },
    role: {
      type: String,
      enum: {
        values: ['DONOR', 'HOSPITAL', 'ADMIN'] as UserRole[],
        message: '{VALUE} is not a valid role',
      },
      required: [true, 'User role is required'],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    passwordResetHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const clean = ret as Record<string, unknown>;
        delete clean.passwordHash;
        delete clean.passwordResetHash;
        delete clean.passwordResetExpires;
        delete clean.__v;
        return clean;
      },
    },
    toObject: {
      transform(_doc, ret) {
        const clean = ret as Record<string, unknown>;
        delete clean.passwordHash;
        delete clean.passwordResetHash;
        delete clean.passwordResetExpires;
        delete clean.__v;
        return clean;
      },
    },
  }
);

// Method to explicitly return safe user projection
userSchema.methods.toSafeObject = function (): Record<string, unknown> {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetHash;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

export const User: Model<IUserDocument> = model<IUserDocument>('User', userSchema);
export default User;
