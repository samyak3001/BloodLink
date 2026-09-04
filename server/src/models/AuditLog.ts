import { Schema, model, Model, Document } from 'mongoose';
import { IAuditLog } from '../types';

export interface IAuditLogDocument extends Omit<IAuditLog, '_id'>, Document {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor user ID is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      index: true,
    },
    resource: {
      type: String,
      required: [true, 'Target resource is required'],
      trim: true,
    },
    resourceId: {
      type: String,
      trim: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
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

// Compound index for querying actor audit trails chronologically
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLogDocument> = model<IAuditLogDocument>(
  'AuditLog',
  auditLogSchema
);
export default AuditLog;
