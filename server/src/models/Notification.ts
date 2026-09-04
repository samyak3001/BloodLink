import { Schema, model, Model, Document } from 'mongoose';
import { INotification } from '../types';

export interface INotificationDocument extends Omit<INotification, '_id'>, Document {}

const notificationSchema = new Schema<INotificationDocument>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user ID is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['EMERGENCY_ALERT', 'DONOR_ACCEPTED', 'DONOR_DECLINED', 'STATUS_UPDATE', 'SYSTEM'],
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [500, 'Message cannot exceed 500 characters'],
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
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

// Compound index for fast queries of unread user notifications
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification: Model<INotificationDocument> = model<INotificationDocument>(
  'Notification',
  notificationSchema
);
export default Notification;
