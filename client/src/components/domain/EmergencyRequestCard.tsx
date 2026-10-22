import React from 'react';
import {
  Building2,
  Clock,
  MapPin,
  Activity,
  ArrowRight,
  Check,
  X,
  CheckCircle2,
  XCircle,
  PhoneCall,
  Calendar,
  AlertCircle,
  Hourglass,
} from 'lucide-react';
import { BloodGroup, BloodComponent, RequestUrgency, RequestStatus, CoordinationStatus } from '../../types';
import { isBloodCompatible } from '../../utils/bloodCompatibility';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

function formatDateTime(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getExpiryInfo(createdAt?: string, requiredWithinHours?: number, expiresAtProp?: string) {
  if (!createdAt && !expiresAtProp) return null;
  const created = createdAt ? new Date(createdAt).getTime() : 0;
  const target = expiresAtProp
    ? new Date(expiresAtProp).getTime()
    : created + (requiredWithinHours || 3) * 3600 * 1000;

  if (isNaN(target) || target <= 0) return null;

  const now = Date.now();
  const diffMs = target - now;
  const isExpired = diffMs <= 0;

  const targetDateFormatted = new Date(target).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isExpired) {
    return {
      isExpired: true,
      text: `Expired (${targetDateFormatted})`,
      targetDateFormatted,
    };
  }

  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const remainingStr = hours > 0 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`;

  return {
    isExpired: false,
    text: `Due: ${targetDateFormatted} (${remainingStr})`,
    targetDateFormatted,
    remainingStr,
  };
}

export interface EmergencyRequestCardProps {
  id: string;
  patientIdentifier: string;
  bloodGroup: BloodGroup;
  bloodComponent?: BloodComponent;
  unitsRequired: number;
  urgency: RequestUrgency;
  status: RequestStatus;
  hospitalName?: string;
  city?: string;
  distanceFormatted?: string;
  estimatedTransitTimeMinutes?: number;
  requiredWithinHours?: number;
  createdAt?: string;
  expiresAt?: string;
  notes?: string;
  donorBloodGroup?: BloodGroup;
  myResponseStatus?: 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | null;
  donorResponseStatus?: 'NOTIFIED' | 'ACCEPTED' | 'DECLINED' | null;
  coordinationStatus?: CoordinationStatus | null;
  isResponding?: boolean;
  respondingAction?: 'ACCEPTED' | 'DECLINED' | null;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  className?: string;
}

export const EmergencyRequestCard: React.FC<EmergencyRequestCardProps> = ({
  id,
  patientIdentifier,
  bloodGroup,
  bloodComponent = 'WHOLE_BLOOD',
  unitsRequired,
  urgency,
  status,
  hospitalName,
  city,
  distanceFormatted,
  estimatedTransitTimeMinutes,
  requiredWithinHours,
  createdAt,
  expiresAt,
  notes,
  donorBloodGroup,
  myResponseStatus,
  donorResponseStatus,
  coordinationStatus,
  isResponding = false,
  respondingAction = null,
  onAccept,
  onDecline,
  onViewDetails,
  className,
}) => {
  const effectiveResponseStatus = donorResponseStatus || myResponseStatus || 'NOTIFIED';
  const isCompatible = donorBloodGroup
    ? isBloodCompatible(donorBloodGroup, bloodGroup, bloodComponent)
    : true;
  const isContacted = coordinationStatus === 'CONTACTED';

  const expiryInfo = getExpiryInfo(createdAt, requiredWithinHours, expiresAt);
  const isEffectiveExpired = status === 'EXPIRED' || Boolean(expiryInfo?.isExpired);

  const displayHospitalName = hospitalName?.trim() || 'Hospital information unavailable';
  const displayLocation = city?.trim() || 'Location unavailable';

  return (
    <Card
      hoverable
      className={cn(
        'border-l-4 transition-all duration-200',
        isEffectiveExpired
          ? 'border-l-slate-400 bg-slate-50/50 shadow-soft opacity-90'
          : urgency === 'CRITICAL'
          ? 'border-l-emergency-600 bg-white shadow-soft'
          : urgency === 'HIGH'
          ? 'border-l-amber-500 bg-white shadow-soft'
          : 'border-l-clinical-500 bg-white shadow-soft',
        className
      )}
    >
      <CardContent className="p-5 space-y-4">
        {/* Top Header: Urgency & Status Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge urgency={urgency} />
            <span className="text-[11px] font-mono text-slate-400">
              Ref: {patientIdentifier}
            </span>
            {donorBloodGroup && !isCompatible && (
              <span className="text-[10px] font-bold text-emergency-700 bg-emergency-50 px-2 py-0.5 rounded-full border border-emergency-200">
                Incompatible with {donorBloodGroup}
              </span>
            )}
          </div>

          <Badge status={isEffectiveExpired ? 'EXPIRED' : status} />
        </div>

        {/* Hospital Coordination Banner */}
        {isContacted && effectiveResponseStatus === 'ACCEPTED' && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800">
            <PhoneCall className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-blue-800">🏥 Hospital has initiated coordination — Please proceed to the hospital</p>
              <p className="text-[11px] text-blue-700">
                {hospitalName || 'The hospital'} is ready for your donation. Follow their instructions upon arrival.
              </p>
            </div>
          </div>
        )}

        {/* Main Blood & Hospital Details */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center justify-center p-2.5 bg-emergency-50 border border-emergency-200 rounded-xl">
              <span className="text-xl font-extrabold text-emergency-700 font-mono tracking-tight leading-none">
                {bloodGroup}
              </span>
              <span className="text-[9px] font-bold text-emergency-600 uppercase tracking-widest mt-1">
                {bloodComponent.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {unitsRequired} Unit{unitsRequired > 1 ? 's' : ''} Needed Urgently
              </h4>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400 font-medium">Requested by:</span>
                <span className="font-bold text-slate-800 truncate">{displayHospitalName}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400 font-medium">Location:</span>
                <span className="text-slate-700">{displayLocation}</span>
                {distanceFormatted && distanceFormatted !== 'Local Hospital' && (
                  <span className="font-semibold text-slate-700">
                    • {distanceFormatted}
                  </span>
                )}
              </div>

              {createdAt && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Requested on:</span>
                  <span className="font-semibold text-slate-800">{formatDateTime(createdAt)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes snippet if present */}
        {notes && (
          <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            "{notes}"
          </p>
        )}

        {/* Metadata Footer: Transit & Expiry */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-3 flex-wrap">
            {estimatedTransitTimeMinutes !== undefined && (
              <div className="flex items-center gap-1 font-medium text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>~{estimatedTransitTimeMinutes} mins transit</span>
              </div>
            )}

            {expiryInfo ? (
              <div
                className={cn(
                  'flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-md text-xs',
                  expiryInfo.isExpired
                    ? 'text-red-700 bg-red-50 border border-red-200'
                    : 'text-amber-800 bg-amber-50 border border-amber-200'
                )}
                title={expiryInfo.targetDateFormatted ? `Fulfillment Deadline: ${expiryInfo.targetDateFormatted}` : undefined}
              >
                {expiryInfo.isExpired ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                ) : (
                  <Hourglass className="h-3.5 w-3.5 text-amber-600 shrink-0 animate-pulse" />
                )}
                <span>{expiryInfo.text}</span>
              </div>
            ) : requiredWithinHours !== undefined ? (
              <div className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                <Activity className="h-3 w-3" />
                <span>Within {requiredWithinHours}h</span>
              </div>
            ) : null}
          </div>

          {/* Action Buttons & Response Status Indicators */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isEffectiveExpired ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>Request Expired</span>
              </div>
            ) : effectiveResponseStatus === 'ACCEPTED' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vitality-50 border border-vitality-200 text-vitality-700 text-xs font-semibold shadow-soft-sm">
                <CheckCircle2 className="h-4 w-4 text-vitality-600 shrink-0" />
                <span>You accepted this request</span>
              </div>
            ) : effectiveResponseStatus === 'DECLINED' ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-xs font-medium">
                <XCircle className="h-4 w-4 text-slate-400 shrink-0" />
                <span>You declined this request</span>
              </div>
            ) : (
              <>
                {onDecline && (status === 'ACTIVE' || status === 'MATCHED') && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isResponding}
                    isLoading={isResponding && respondingAction === 'DECLINED'}
                    onClick={() => onDecline(id)}
                    leftIcon={<X className="h-3.5 w-3.5" />}
                  >
                    Decline
                  </Button>
                )}

                {onAccept && (status === 'ACTIVE' || status === 'MATCHED') && (
                  isCompatible ? (
                    <Button
                      size="sm"
                      variant="vitality"
                      disabled={isResponding}
                      isLoading={isResponding && respondingAction === 'ACCEPTED'}
                      onClick={() => onAccept(id)}
                      leftIcon={<Check className="h-3.5 w-3.5" />}
                    >
                      Accept
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      className="opacity-50 cursor-not-allowed text-xs text-slate-400 bg-slate-50 border-slate-200"
                      title={`Blood group incompatible: Donor (${donorBloodGroup}) cannot donate to recipient with blood group (${bloodGroup})`}
                    >
                      Incompatible
                    </Button>
                  )
                )}
              </>
            )}

            {onViewDetails && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onViewDetails(id)}
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
              >
                Details
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
