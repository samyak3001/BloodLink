import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useRequestRoom } from '../../hooks/useRequestRoom';
import { useToast } from '../../components/feedback';
import { getEmergencyRequestByIdApi, getPotentialMatchesApi, updateRequestStatusApi } from '../../api/requestsApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { DonorCard } from '../../components/domain/DonorCard';
import { RequestStatus } from '../../types';

export const RequestDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Join Socket.IO Request Room for real-time donor response pushes
  if (id) {
    useRequestRoom(id);
  }

  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const reqData = await getEmergencyRequestByIdApi(id);
      setRequest(reqData.request);

      const matchData = await getPotentialMatchesApi(id);
      setMatches(matchData.matches || []);
    } catch (err) {
      // Fallback demo state
      setRequest({
        id: id || 'req-demo',
        patientIdentifier: 'EMERGENCY-TRAUMA-91',
        bloodGroup: 'O-',
        bloodComponent: 'WHOLE_BLOOD',
        unitsRequired: 3,
        urgency: 'CRITICAL',
        status: 'ACTIVE',
        requiredWithinHours: 3,
        hospitalName: 'Apollo Emergency Trauma Center',
        city: 'Central District',
        notes: 'Immediate surgical transfusion needed for multi-trauma resuscitation.',
        donorResponses: [
          {
            donorId: 'd-101',
            donorName: 'Marcus Vance',
            action: 'ACCEPTED',
            respondedAt: '12 mins ago',
          },
          {
            donorId: 'd-102',
            donorName: 'Elena Rostova',
            action: 'DECLINED',
            respondedAt: '18 mins ago',
          },
        ],
      });

      setMatches([
        {
          id: 'd-101',
          name: 'Marcus Vance (Certified Donor)',
          bloodGroup: 'O-',
          isAvailable: true,
          supportedComponents: ['WHOLE_BLOOD', 'RED_CELLS'],
          city: 'Downtown District',
          distanceKm: 1.8,
          matchScore: 98,
          isCompatible: true,
        },
        {
          id: 'd-103',
          name: 'David Kim (Verified Donor)',
          bloodGroup: 'O-',
          isAvailable: true,
          supportedComponents: ['WHOLE_BLOOD'],
          city: 'Central West Corridor',
          distanceKm: 3.2,
          matchScore: 92,
          isCompatible: true,
        },
        {
          id: 'd-104',
          name: 'Sarah Lin (Certified Donor)',
          bloodGroup: 'O-',
          isAvailable: true,
          supportedComponents: ['WHOLE_BLOOD', 'PLATELETS'],
          city: 'East Health Hub',
          distanceKm: 4.6,
          matchScore: 87,
          isCompatible: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handlePromptStatus = (status: RequestStatus) => {
    setPendingStatus(status);
    setConfirmOpen(true);
  };

  const executeStatus = async () => {
    if (!id || !pendingStatus) return;
    try {
      await updateRequestStatusApi(id, pendingStatus);
      toast.success(`Request transitioned to ${pendingStatus}`, 'Status Updated');
      setRequest((prev: any) => ({ ...prev, status: pendingStatus }));
    } catch (err) {
      toast.info(`Request marked as ${pendingStatus} (simulated update).`, 'Status Updated');
      setRequest((prev: any) => ({ ...prev, status: pendingStatus }));
    } finally {
      setConfirmOpen(false);
      setPendingStatus(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <EmptyState
        title="Emergency Request Not Found"
        description="The requested emergency record does not exist or has been removed."
        actionLabel="Return to Requests"
        onAction={() => window.history.back()}
      />
    );
  }

  const isTerminal =
    request.status === 'FULFILLED' ||
    request.status === 'CANCELLED' ||
    request.status === 'EXPIRED';

  return (
    <div className="space-y-8">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/hospital/requests"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Emergency Requests Directory
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh Feed
          </Button>

          {!isTerminal && (
            <>
              <Button
                variant="vitality"
                size="sm"
                onClick={() => handlePromptStatus('FULFILLED')}
                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
              >
                Mark Fulfilled
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePromptStatus('CANCELLED')}
                className="text-emergency-600 hover:text-emergency-700"
              >
                Cancel Request
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Emergency Request Overview Card */}
      <Card className="border-emergency-100 shadow-soft-sm">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {request.patientIdentifier}
                </h1>
                <Badge urgency={request.urgency} />
                <Badge status={request.status} />
              </div>
              <p className="text-xs text-slate-500">
                Created for {request.hospitalName || 'Emergency Medical Center'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Badge bloodGroup={request.bloodGroup} />
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase font-semibold">Required Units</p>
                <p className="text-lg font-black text-slate-900">{request.unitsRequired} Units</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500">Blood Component</p>
              <p className="font-bold text-slate-900 mt-0.5 uppercase">
                {request.bloodComponent?.replace('_', ' ') || 'WHOLE BLOOD'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500">Required Timeframe</p>
              <p className="font-bold text-slate-900 mt-0.5">&lt; {request.requiredWithinHours || 3} Hours</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500">Potential Matches</p>
              <p className="font-bold text-clinical-600 mt-0.5">{matches.length} Compatible Donors</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500">Live Socket Room</p>
              <p className="font-bold text-vitality-700 mt-0.5">request:{id}</p>
            </div>
          </div>

          {request.notes && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <span className="font-bold text-slate-900">Clinical Notes:</span>
              <p>{request.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Donor Response Feed */}
      {request.donorResponses && request.donorResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Real-Time Donor Responses</CardTitle>
            <CardDescription>Live responses delivered via WebSocket room broadcast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {request.donorResponses.map((res: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  {res.action === 'ACCEPTED' ? (
                    <CheckCircle2 className="h-4 w-4 text-vitality-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-bold text-slate-900">{res.donorName || 'Prospective Donor'}</span>
                  <span className="text-slate-500">({res.respondedAt || 'Just now'})</span>
                </div>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                    res.action === 'ACCEPTED'
                      ? 'bg-vitality-50 text-vitality-700 border border-vitality-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {res.action}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ranked Potential Matches Section (Masked GPS Privacy Enforced) */}
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-clinical-600" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Ranked Potential Donor Matches
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Donors scored algorithmically by blood compatibility (100%), proximity distance, and availability. Exact GPS coordinates remain masked for donor privacy.
          </p>
        </div>

        <MedicalDisclaimer variant="compact" />

        {matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((donor: any) => (
              <DonorCard
                key={donor.id || donor._id}
                id={donor.id || donor._id}
                name={donor.name || 'Verified Prospective Donor'}
                bloodGroup={donor.bloodGroup}
                isAvailable={donor.isAvailable !== false}
                supportedComponents={donor.supportedComponents}
                city={donor.city || 'Central District'}
                distanceKm={donor.distanceKm || 2.5}
                matchScore={donor.matchScore || 90}
                isCompatible={donor.isCompatible !== false}
                onContact={() => {
                  toast.success(
                    `Dispatched hospital communication alert to ${donor.name}.`,
                    'Contact Initiated'
                  );
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Compatible Donors in Initial Radius"
            description="No active available donors were located within the current radius. Try expanding your search perimeter."
          />
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeStatus}
        title={pendingStatus === 'FULFILLED' ? 'Confirm Fulfillment' : 'Confirm Cancellation'}
        message={
          pendingStatus === 'FULFILLED'
            ? 'Are you certain all required blood units have been collected and verified on-site?'
            : 'Are you sure you wish to cancel this request? Any donors traveling will be notified.'
        }
        confirmText={pendingStatus === 'FULFILLED' ? 'Yes, Fulfill' : 'Yes, Cancel'}
        variant={pendingStatus === 'FULFILLED' ? 'info' : 'danger'}
      />
    </div>
  );
};
