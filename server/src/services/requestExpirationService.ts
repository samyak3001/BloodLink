import { EmergencyRequest, AuditLog } from '../models';
import { isDbConnected } from '../config/database';
import { emitRequestUpdated } from './socketService';

/**
 * Checks all ACTIVE and MATCHED emergency requests against their requiredWithinHours timeframe.
 * If the deadline has elapsed without fulfillment, automatically transitions the request status to EXPIRED.
 * 
 * Returns the count of newly expired requests.
 */
export async function autoExpireOverdueRequests(): Promise<number> {
  // Guard: if database is not connected (e.g. during standalone unit tests), silently return 0
  if (!isDbConnected()) {
    return 0;
  }

  try {
    const now = new Date();

    // Query all active and matched requests
    const candidates = await EmergencyRequest.find({
      status: { $in: ['ACTIVE', 'MATCHED'] },
    });

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return 0;
    }

    let expiredCount = 0;

    for (const req of candidates) {
      const createdTime = req.createdAt ? new Date(req.createdAt).getTime() : 0;
      const hours = typeof req.requiredWithinHours === 'number' && req.requiredWithinHours > 0
        ? req.requiredWithinHours
        : 3;
      const expiresAt = createdTime + hours * 3600 * 1000;

      if (createdTime > 0 && now.getTime() > expiresAt) {
        req.status = 'EXPIRED';
        await req.save();
        expiredCount++;

        // Real-time broadcast so connected donor/hospital UI updates instantly
        try {
          emitRequestUpdated(req._id.toString(), {
            requestId: req._id.toString(),
            previousStatus: 'ACTIVE',
            newStatus: 'EXPIRED',
            bloodGroup: req.bloodGroup,
            urgency: req.urgency,
            updatedBy: 'system',
            timestamp: now.toISOString(),
          });
        } catch {
          // Socket service errors are non-fatal
        }

        // Security audit logging
        void AuditLog.create({
          actorId: req.hospitalId,
          action: 'EMERGENCY_REQUEST_STATUS_UPDATED',
          resource: 'EmergencyRequest',
          resourceId: req._id.toString(),
          details: {
            previousStatus: 'ACTIVE',
            newStatus: 'EXPIRED',
            reason: `Automatic expiry: timeframe of ${hours} hours exceeded without fulfillment.`,
            createdAt: req.createdAt,
            expiredAt: now,
          },
        }).catch(() => {});
      }
    }

    if (expiredCount > 0) {
      console.log(`[Auto-Expiration] Automatically expired ${expiredCount} overdue emergency request(s).`);
    }

    return expiredCount;
  } catch (error) {
    console.error('[Auto-Expiration] Error checking overdue requests:', error);
    return 0;
  }
}
