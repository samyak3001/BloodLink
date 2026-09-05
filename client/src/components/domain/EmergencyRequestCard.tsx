import React from 'react';
import { Building2, Clock, MapPin, Activity, ArrowRight, Check, X } from 'lucide-react';
import { BloodGroup, BloodComponent, RequestUrgency, RequestStatus } from '../../types';
import { isBloodCompatible } from '../../utils/bloodCompatibility';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

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
  notes?: string;
  donorBloodGroup?: BloodGroup;
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
  notes,
  donorBloodGroup,
  onAccept,
  onDecline,
  onViewDetails,
  className,
}) => {
  const isCompatible = donorBloodGroup
    ? isBloodCompatible(donorBloodGroup, bloodGroup, bloodComponent)
    : true;

  const displayHospitalName = hospitalName?.trim() || 'Hospital information unavailable';
  const displayLocation = city?.trim() || 'Location unavailable';

  return (
    <Card
      hoverable
      className={cn(
        'border-l-4 transition-all duration-200',
        urgency === 'CRITICAL'
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

          <Badge status={status} />
        </div>

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

            {requiredWithinHours !== undefined && (
              <div className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
                <Activity className="h-3 w-3" />
                <span>Within {requiredWithinHours}h</span>
              </div>
            )}

            {createdAt && (
              <span className="text-[11px] text-slate-400">
                Posted {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {onDecline && status === 'ACTIVE' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecline(id)}
                leftIcon={<X className="h-3.5 w-3.5" />}
              >
                Decline
              </Button>
            )}

            {onAccept && status === 'ACTIVE' && (
              isCompatible ? (
                <Button
                  size="sm"
                  variant="vitality"
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
