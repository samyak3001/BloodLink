import React from 'react';
import { MapPin, CheckCircle2, HeartHandshake, PhoneCall } from 'lucide-react';
import { BloodGroup, BloodComponent } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

export interface DonorCardProps {
  id: string;
  name: string;
  bloodGroup: BloodGroup;
  isAvailable: boolean;
  supportedComponents?: BloodComponent[];
  city?: string;
  district?: string;
  distanceKm?: number;
  matchScore?: number;
  isCompatible?: boolean;
  phone?: string;
  onContact?: (id: string) => void;
  className?: string;
}

export const DonorCard: React.FC<DonorCardProps> = ({
  id,
  name,
  bloodGroup,
  isAvailable,
  supportedComponents = ['WHOLE_BLOOD'],
  city = 'Local Area',
  district,
  distanceKm,
  matchScore,
  isCompatible = true,
  phone,
  onContact,
  className,
}) => {
  return (
    <Card hoverable className={cn('relative overflow-hidden', className)}>
      {/* Compatibility Banner if matched */}
      {matchScore && (
        <div className="absolute top-0 right-0 bg-vitality-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-soft flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          <span>{matchScore}% Match Score</span>
        </div>
      )}

      <CardContent className="p-5 space-y-4">
        {/* Donor Header */}
        <div className="flex items-start gap-3.5">
          <div className="flex flex-col items-center">
            <Badge bloodGroup={bloodGroup} className="text-sm px-3 py-1.5 shadow-soft" />
            <span className="text-[10px] text-slate-400 font-medium mt-1 uppercase tracking-wider">
              Group
            </span>
          </div>

          <div className="flex-1 min-w-0 pr-16">
            <h4 className="text-sm font-bold text-slate-900 truncate">{name}</h4>
            <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 truncate">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {city}
                {district ? `, ${district}` : ''}
                {distanceKm !== undefined && (
                  <strong className="text-slate-700 ml-1 font-semibold">
                    ({distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)} km`})
                  </strong>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  isAvailable
                    ? 'bg-vitality-50 text-vitality-700 border-vitality-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isAvailable ? 'bg-vitality-500 animate-pulse' : 'bg-slate-400'
                  )}
                />
                {isAvailable ? 'Available Now' : 'Currently Unavailable'}
              </span>

              {isCompatible && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-clinical-700 bg-clinical-50 px-2 py-0.5 rounded-full border border-clinical-200">
                  <CheckCircle2 className="h-3 w-3 text-clinical-500" />
                  Compatible
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Supported Components */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <HeartHandshake className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Supports:{' '}
              <strong className="text-slate-700 font-medium">
                {supportedComponents.map((c) => c.replace('_', ' ')).join(', ')}
              </strong>
            </span>
          </div>

          {onContact && (
            <Button
              size="sm"
              variant="clinical"
              onClick={() => onContact(id)}
              leftIcon={<PhoneCall className="h-3.5 w-3.5" />}
            >
              {phone ? phone : 'Contact Donor'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
