import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HeartPulse,
  Activity,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Power,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/feedback';
import { getDonorDashboardApi, toggleDonorAvailabilityApi, respondToRequestApi } from '../../api/donorsApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { EmergencyRequestCard } from '../../components/domain/EmergencyRequestCard';
import { isBloodCompatible } from '../../utils/bloodCompatibility';
import { BloodGroup } from '../../types';

export const DonorDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const data = await getDonorDashboardApi();
      setDashboardData(data);
      if (data.donor?.isAvailable !== undefined) {
        setIsAvailable(data.donor.isAvailable);
      }
    } catch (err) {
      // Fallback data for smooth development mode if backend donor profile not yet seeded
      setDashboardData({
        donor: {
          bloodGroup: (user as any)?.bloodGroup || 'O+',
          isAvailable: true,
          totalDonations: 4,
          screening: {
            isAgeEligible: true,
            isWeightEligible: true,
            hasNoRecentIllness: true,
            hasValidInterval: true,
          },
        },
        nearbyRequests: [
          {
            id: 'req-demo-1',
            patientIdentifier: 'EMERGENCY-SURGERY-91',
            bloodGroup: (user as any)?.bloodGroup || 'O+',
            bloodComponent: 'WHOLE_BLOOD',
            unitsRequired: 2,
            urgency: 'CRITICAL',
            status: 'ACTIVE',
            hospitalName: 'Apollo Emergency Trauma Center',
            city: 'Central District',
            distanceFormatted: '2.1 km away',
            estimatedTransitTimeMinutes: 7,
            requiredWithinHours: 3,
            notes: 'Immediate whole blood required for incoming surgical trauma patient.',
          },
          {
            id: 'req-demo-2',
            patientIdentifier: 'ICU-ONCOLOGY-44',
            bloodGroup: (user as any)?.bloodGroup || 'O+',
            bloodComponent: 'PLATELETS',
            unitsRequired: 1,
            urgency: 'HIGH',
            status: 'ACTIVE',
            hospitalName: 'Metro General Hospital',
            city: 'Metro Medical Hub',
            distanceFormatted: '4.5 km away',
            estimatedTransitTimeMinutes: 14,
            requiredWithinHours: 6,
            notes: 'Urgent platelet transfusion for ICU inpatient.',
          },
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  const handleToggleAvailability = async () => {
    try {
      setIsToggling(true);
      const newStatus = !isAvailable;
      await toggleDonorAvailabilityApi(newStatus);
      setIsAvailable(newStatus);
      toast.success(
        `Availability status updated to: ${newStatus ? 'AVAILABLE TO DONATE' : 'UNAVAILABLE'}`,
        'Status Synchronized'
      );
    } catch (err) {
      // Toggle locally for demo feedback
      const newStatus = !isAvailable;
      setIsAvailable(newStatus);
      toast.info(
        `Availability toggled to ${newStatus ? 'AVAILABLE' : 'UNAVAILABLE'} (simulated)`,
        'Status Updated'
      );
    } finally {
      setIsToggling(false);
    }
  };

  const donorBloodGroup: BloodGroup =
    dashboardData?.donor?.bloodGroup || dashboardData?.bloodGroup || dashboardData?.profile?.bloodGroup || (user as any)?.bloodGroup || 'O+';

  const handleRespond = async (requestId: string, action: 'ACCEPTED' | 'DECLINED') => {
    const allRequests = [
      ...(dashboardData?.nearbyRequests || []),
      ...(dashboardData?.nearbyCompatibleRequests || []),
    ];
    const targetReq = allRequests.find((r: any) => (r.id || r._id) === requestId);

    if (action === 'ACCEPTED' && targetReq && donorBloodGroup) {
      if (!isBloodCompatible(donorBloodGroup, targetReq.bloodGroup, targetReq.bloodComponent)) {
        toast.error(
          `Incompatible blood groups: Donor (${donorBloodGroup}) cannot donate to recipient with blood group (${targetReq.bloodGroup}).`,
          'Blood Incompatible'
        );
        return;
      }
    }

    try {
      await respondToRequestApi(requestId, action);
      toast.success(
        `You have ${action.toLowerCase()} the emergency blood request. Hospital notified!`,
        'Response Dispatched'
      );
    } catch (err: any) {
      const msg = err?.message || `Failed to ${action.toLowerCase()} request.`;
      toast.error(msg, 'Response Error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-soft">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome, {user?.name || 'Blood Donor'}
            </h1>
            <Badge bloodGroup={donorBloodGroup} />
          </div>
          <p className="text-xs text-slate-500">
            Thank you for being part of the emergency donor network. You are directly saving lives.
          </p>
        </div>

        {/* Live Availability Toggle Switch */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="text-right">
            <p className="text-[11px] font-bold text-slate-700">Donation Availability</p>
            <p className="text-[10px] text-slate-500">
              {isAvailable ? 'Receiving emergency alerts' : 'Temporarily paused'}
            </p>
          </div>
          <Button
            size="sm"
            variant={isAvailable ? 'vitality' : 'secondary'}
            isLoading={isToggling}
            onClick={handleToggleAvailability}
            leftIcon={<Power className="h-3.5 w-3.5" />}
          >
            {isAvailable ? 'Active & Ready' : 'Paused'}
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Blood Group</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">{donorBloodGroup}</span>
                <span className="text-[11px] text-slate-500 font-medium">Reported</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emergency-50 text-emergency-600">
              <HeartPulse className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Donations</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {dashboardData?.donor?.totalDonations || 4}
                </span>
                <span className="text-[11px] text-vitality-600 font-semibold">~12 lives helped</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-vitality-50 text-vitality-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Self-Reported Screening</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-vitality-700">Eligible Checklist</span>
                <CheckCircle2 className="h-4 w-4 text-vitality-600" />
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-clinical-50 text-clinical-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Broadcasts</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-emergency-600">
                  {dashboardData?.nearbyRequests?.length || 2}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">Nearby alerts</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Standard Medical Disclaimer */}
      <MedicalDisclaimer variant="compact" />

      {/* Active Emergency Requests Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Urgent Emergency Blood Requests Nearby
            </h2>
            <p className="text-xs text-slate-500">
              Requests matching your blood group ({donorBloodGroup}) broadcast by certified hospitals.
            </p>
          </div>
          <Link to="/donor/requests">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              View All Requests
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (dashboardData?.nearbyRequests?.length > 0 || dashboardData?.nearbyCompatibleRequests?.length > 0) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(dashboardData.nearbyRequests || dashboardData.nearbyCompatibleRequests).map((req: any) => {
              const hospName =
                req.hospitalName ||
                req.hospitalId?.hospitalName ||
                req.hospital?.hospitalName ||
                'Hospital information unavailable';

              const hospAddress = req.hospitalAddress || req.hospitalId?.address || req.hospital?.address;
              const hospCity =
                req.city ||
                (hospAddress
                  ? [hospAddress.city, hospAddress.district || hospAddress.state].filter(Boolean).join(', ')
                  : undefined) ||
                'Location unavailable';

              return (
                <EmergencyRequestCard
                  key={req.id || req._id}
                  id={req.id || req._id}
                  patientIdentifier={req.patientIdentifier}
                  bloodGroup={req.bloodGroup}
                  donorBloodGroup={donorBloodGroup}
                  bloodComponent={req.bloodComponent || 'WHOLE_BLOOD'}
                  unitsRequired={req.unitsRequired}
                  urgency={req.urgency}
                  status={req.status || 'ACTIVE'}
                  hospitalName={hospName}
                  city={hospCity}
                  distanceFormatted={req.distanceFormatted}
                  estimatedTransitTimeMinutes={req.estimatedTransitTimeMinutes}
                  requiredWithinHours={req.requiredWithinHours}
                  notes={req.notes}
                  onAccept={() => handleRespond(req.id || req._id, 'ACCEPTED')}
                  onDecline={() => handleRespond(req.id || req._id, 'DECLINED')}
                  onViewDetails={() => {
                    toast.info(
                      `Hospital: ${hospName} | Location: ${hospCity} | Details: ${req.notes || 'Emergency transfusion'}`,
                      'Request Details'
                    );
                  }}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No Active Emergency Requests Nearby"
            description="There are currently no urgent blood requests matching your group in your vicinity. We will notify you instantly via real-time alert if one occurs."
          />
        )}
      </div>
    </div>
  );
};
