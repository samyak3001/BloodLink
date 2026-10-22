import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/feedback';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { getEmergencyRequestsApi } from '../../api/requestsApi';
import { respondToRequestApi, getDonorDashboardApi } from '../../api/donorsApi';
import { isBloodCompatible } from '../../utils/bloodCompatibility';
import { BloodGroup } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { EmergencyRequestCard } from '../../components/domain/EmergencyRequestCard';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const DonorRequestsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { isConnected } = useSocket();

  const [donorBloodGroup, setDonorBloodGroup] = useState<BloodGroup | undefined>(
    (profile as any)?.bloodGroup || (user as any)?.bloodGroup
  );

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');

  // Confirmation dialog state
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'ACCEPTED' | 'DECLINED' } | null>(null);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [respondingAction, setRespondingAction] = useState<'ACCEPTED' | 'DECLINED' | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRequests = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) {
        setIsLoading(true);
        setError(null);
      }
      const params: Record<string, string> = { status: 'ACTIVE' };
      if (selectedBloodGroup !== 'ALL') params.bloodGroup = selectedBloodGroup;
      if (selectedUrgency !== 'ALL') params.urgency = selectedUrgency;

      const data = await getEmergencyRequestsApi(params);
      setRequests(data.requests || []);
    } catch (err: unknown) {
      if (!isBackground) {
        setRequests([]);
        const msg = err instanceof Error ? err.message : 'Failed to fetch emergency requests.';
        setError(msg);
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, [selectedBloodGroup, selectedUrgency]);

  useEffect(() => {
    const bg = (profile as any)?.bloodGroup || (user as any)?.bloodGroup;
    if (bg) {
      setDonorBloodGroup(bg);
    } else {
      getDonorDashboardApi()
        .then((data) => {
          const fetchedBg = data?.dashboard?.bloodGroup || data?.donor?.bloodGroup || data?.bloodGroup || data?.profile?.bloodGroup;
          if (fetchedBg) setDonorBloodGroup(fetchedBg);
        })
        .catch(() => {});
    }
  }, [user, profile]);

  useEffect(() => {
    fetchRequests(false);
  }, [fetchRequests]);

  // Real-time socket event listeners
  useSocketEvent('emergency:alert', useCallback(() => {
    fetchRequests(true);
  }, [fetchRequests]));

  useSocketEvent('request:updated', useCallback(() => {
    fetchRequests(true);
  }, [fetchRequests]));

  // Polling fallback when Socket.IO is disconnected
  useEffect(() => {
    const clearPoll = () => {
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    if (user && !isConnected) {
      if (pollTimerRef.current === null) {
        pollTimerRef.current = setInterval(() => {
          fetchRequests(true);
        }, 12000);
      }
    } else {
      clearPoll();
    }

    return clearPoll;
  }, [user, isConnected, fetchRequests]);

  const handlePromptAction = (id: string, action: 'ACCEPTED' | 'DECLINED') => {
    const targetReq = requests.find((r) => (r.id || r._id) === id);

    // Guard: if the donor has already responded (state may be stale from a previous
    // session or another tab), silently skip — the card already shows the status badge.
    if (
      targetReq?.myResponseStatus === 'ACCEPTED' ||
      targetReq?.myResponseStatus === 'DECLINED'
    ) {
      return;
    }

    if (action === 'ACCEPTED' && targetReq && donorBloodGroup) {
      if (!isBloodCompatible(donorBloodGroup, targetReq.bloodGroup, targetReq.bloodComponent)) {
        toast.error(
          `Incompatible blood groups: Donor (${donorBloodGroup}) cannot donate to recipient with blood group (${targetReq.bloodGroup}).`,
          'Blood Incompatible'
        );
        return;
      }
    }
    setPendingAction({ id, action });
    setConfirmModalOpen(true);
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    const { id, action } = pendingAction;

    if (action === 'ACCEPTED' && donorBloodGroup) {
      const targetReq = requests.find((r) => (r.id || r._id) === id);
      if (targetReq && !isBloodCompatible(donorBloodGroup, targetReq.bloodGroup, targetReq.bloodComponent)) {
        toast.error(
          `Incompatible blood groups: Donor (${donorBloodGroup}) cannot donate to recipient with blood group (${targetReq.bloodGroup}).`,
          'Blood Incompatible'
        );
        setConfirmModalOpen(false);
        setPendingAction(null);
        return;
      }
    }

    try {
      setRespondingRequestId(id);
      setRespondingAction(action);

      await respondToRequestApi(id, action);

      // Immediately synchronize local state so card reflects response status
      setRequests((prev) =>
        prev.map((r) =>
          (r.id || r._id) === id
            ? { ...r, myResponseStatus: action, donorResponseStatus: action }
            : r
        )
      );

      if (action === 'ACCEPTED') {
        toast.success(
          'You have accepted this emergency request. The hospital dispatch team has been notified.',
          'Response Dispatched'
        );
      } else {
        toast.info(
          'You have declined this emergency request.',
          'Response Recorded'
        );
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || `Failed to ${action.toLowerCase()} request.`;
      const isAlreadyAccepted =
        msg.toLowerCase().includes('already accepted') ||
        msg.toLowerCase().includes("responded 'accepted'");
      const isAlreadyDeclined =
        msg.toLowerCase().includes('already declined') ||
        msg.toLowerCase().includes("responded 'declined'");

      if (isAlreadyAccepted) {
        setRequests((prev) =>
          prev.map((r) =>
            (r.id || r._id) === id
              ? { ...r, myResponseStatus: 'ACCEPTED', donorResponseStatus: 'ACCEPTED' }
              : r
          )
        );
        toast.info('Already accepted — you have already accepted this request.', 'Status Synchronized');
      } else if (isAlreadyDeclined) {
        setRequests((prev) =>
          prev.map((r) =>
            (r.id || r._id) === id
              ? { ...r, myResponseStatus: 'DECLINED', donorResponseStatus: 'DECLINED' }
              : r
          )
        );
        toast.info('Already declined — you have already declined this request.', 'Status Synchronized');
      } else {
        toast.error(msg, 'Response Error');
      }
    } finally {
      setConfirmModalOpen(false);
      setPendingAction(null);
      setRespondingRequestId(null);
      setRespondingAction(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    // Phase 3: Only show requests that the donor is actually eligible/compatible for
    if (donorBloodGroup && !isBloodCompatible(donorBloodGroup, r.bloodGroup, r.bloodComponent || 'WHOLE_BLOOD')) {
      return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const hospName = r.hospitalName || r.hospitalId?.hospitalName || r.hospital?.hospitalName || '';
    const hospCity = r.city || r.hospitalAddress?.city || r.hospitalId?.address?.city || '';
    return (
      hospName.toLowerCase().includes(q) ||
      hospCity.toLowerCase().includes(q) ||
      r.patientIdentifier?.toLowerCase().includes(q) ||
      r.bloodGroup?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Emergency Blood Requests
          </h1>
          <p className="text-xs text-slate-500">
            Certified medical facilities seeking immediate blood donations.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRequests(false)}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh Feeds
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-emergency-50 border border-emergency-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-emergency-700">{error}</p>
            <p className="text-[11px] text-emergency-600">Failed to communicate with emergency request service.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchRequests(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <Input
          label="Search by Hospital or Code"
          placeholder="e.g. Apollo, Trauma, O+"
          leftIcon={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Select
          label="Filter by Blood Group"
          options={[
            { value: 'ALL', label: 'All Blood Groups' },
            { value: 'O-', label: 'O- (Universal)' },
            { value: 'O+', label: 'O+' },
            { value: 'A-', label: 'A-' },
            { value: 'A+', label: 'A+' },
            { value: 'B-', label: 'B-' },
            { value: 'B+', label: 'B+' },
            { value: 'AB-', label: 'AB-' },
            { value: 'AB+', label: 'AB+' },
          ]}
          value={selectedBloodGroup}
          onChange={(e) => setSelectedBloodGroup(e.target.value)}
        />

        <Select
          label="Filter by Urgency Level"
          options={[
            { value: 'ALL', label: 'All Urgencies' },
            { value: 'CRITICAL', label: 'CRITICAL (Immediate)' },
            { value: 'HIGH', label: 'HIGH (< 6 Hours)' },
            { value: 'MEDIUM', label: 'MEDIUM (< 24 Hours)' },
          ]}
          value={selectedUrgency}
          onChange={(e) => setSelectedUrgency(e.target.value)}
        />
      </div>

      {/* Requests Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredRequests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRequests.map((req: any) => {
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

            const reqId = req.id || req._id;
            const respStatus = req.myResponseStatus || req.donorResponseStatus || 'NOTIFIED';
            return (
              <EmergencyRequestCard
                key={reqId}
                id={reqId}
                patientIdentifier={req.patientIdentifier}
                bloodGroup={req.bloodGroup}
                donorBloodGroup={donorBloodGroup}
                bloodComponent={req.bloodComponent || 'WHOLE_BLOOD'}
                unitsRequired={req.unitsRequired}
                urgency={req.urgency}
                status={req.status || 'ACTIVE'}
                myResponseStatus={respStatus}
                donorResponseStatus={respStatus}
                isResponding={respondingRequestId === reqId}
                respondingAction={respondingRequestId === reqId ? respondingAction : null}
                hospitalName={hospName}
                city={hospCity}
                distanceFormatted={req.distanceFormatted}
                estimatedTransitTimeMinutes={req.estimatedTransitTimeMinutes}
                requiredWithinHours={req.requiredWithinHours}
                createdAt={req.createdAt}
                expiresAt={req.expiresAt}
                notes={req.notes}
                onAccept={() => handlePromptAction(reqId, 'ACCEPTED')}
                onDecline={() => handlePromptAction(reqId, 'DECLINED')}
                onViewDetails={() => {
                  toast.info(
                    `Hospital: ${hospName} | Location: ${hospCity} | Urgency: ${req.urgency} | Timeframe: < ${req.requiredWithinHours || 3} Hours`,
                    'Request Details'
                  );
                }}
              />
            );
          })}
        </div>
      ) : error ? (
        <EmptyState
          title="Unable to Load Emergency Requests"
          description={error}
          actionLabel="Retry"
          onAction={() => fetchRequests(false)}
        />
      ) : (
        <EmptyState
          title="No Matching Requests Found"
          description="Try broadening your blood group or urgency search filter to view more requests."
          actionLabel="Reset Filters"
          onAction={() => {
            setSelectedBloodGroup('ALL');
            setSelectedUrgency('ALL');
            setSearchQuery('');
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={executeAction}
        title={pendingAction?.action === 'ACCEPTED' ? 'Confirm Acceptance' : 'Decline Request'}
        message={
          pendingAction?.action === 'ACCEPTED'
            ? 'Are you able to travel to the facility and donate blood within the required timeframe? The hospital will be notified immediately.'
            : 'Are you sure you wish to decline this request? It will be removed from your active queue.'
        }
        confirmText={pendingAction?.action === 'ACCEPTED' ? 'Yes, I Will Donate' : 'Decline'}
        variant={pendingAction?.action === 'ACCEPTED' ? 'info' : 'danger'}
      />
    </div>
  );
};
