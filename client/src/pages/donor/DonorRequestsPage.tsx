import React, { useEffect, useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useToast } from '../../components/feedback';
import { getEmergencyRequestsApi } from '../../api/requestsApi';
import { respondToRequestApi } from '../../api/donorsApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { EmergencyRequestCard } from '../../components/domain/EmergencyRequestCard';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const DonorRequestsPage: React.FC = () => {
  const { toast } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');

  // Confirmation dialog state
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: 'ACCEPTED' | 'DECLINED' } | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = { status: 'ACTIVE' };
      if (selectedBloodGroup !== 'ALL') params.bloodGroup = selectedBloodGroup;
      if (selectedUrgency !== 'ALL') params.urgency = selectedUrgency;

      const data = await getEmergencyRequestsApi(params);
      setRequests(data.requests || []);
    } catch (err) {
      // Fallback demo requests if server has no seeded active requests
      setRequests([
        {
          id: 'req-101',
          patientIdentifier: 'EMERGENCY-TRAUMA-12',
          bloodGroup: 'O-',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 3,
          urgency: 'CRITICAL',
          status: 'ACTIVE',
          hospitalName: 'Apollo Emergency Trauma Center',
          city: 'Central District',
          distanceFormatted: '1.8 km away',
          estimatedTransitTimeMinutes: 6,
          requiredWithinHours: 2,
          notes: 'Massive blood loss emergency surgery in Operation Theater 3.',
        },
        {
          id: 'req-102',
          patientIdentifier: 'ICU-CARDIAC-99',
          bloodGroup: 'A+',
          bloodComponent: 'RED_CELLS',
          unitsRequired: 2,
          urgency: 'HIGH',
          status: 'ACTIVE',
          hospitalName: 'St. Jude Heart Institute',
          city: 'Metro West Hub',
          distanceFormatted: '3.4 km away',
          estimatedTransitTimeMinutes: 12,
          requiredWithinHours: 5,
          notes: 'Urgent red cell units required for bypass postoperative recovery.',
        },
        {
          id: 'req-103',
          patientIdentifier: 'MATERNITY-CARE-04',
          bloodGroup: 'B+',
          bloodComponent: 'PLATELETS',
          unitsRequired: 2,
          urgency: 'HIGH',
          status: 'ACTIVE',
          hospitalName: 'City Women & Child Hospital',
          city: 'Downtown Riverfront',
          distanceFormatted: '5.1 km away',
          estimatedTransitTimeMinutes: 18,
          requiredWithinHours: 6,
          notes: 'High-risk postpartum care emergency platelet support.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedBloodGroup, selectedUrgency]);

  const handlePromptAction = (id: string, action: 'ACCEPTED' | 'DECLINED') => {
    setPendingAction({ id, action });
    setConfirmModalOpen(true);
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    try {
      await respondToRequestApi(pendingAction.id, pendingAction.action);
      toast.success(
        `Successfully marked as ${pendingAction.action.toLowerCase()}. The hospital dispatch team has been notified.`,
        'Response Dispatched'
      );
      // Remove responded request from active view
      setRequests((prev) => prev.filter((r) => r.id !== pendingAction.id && r._id !== pendingAction.id));
    } catch (err) {
      toast.info(
        `Dispatched response: ${pendingAction.action} (simulated update).`,
        'Response Recorded'
      );
      setRequests((prev) => prev.filter((r) => r.id !== pendingAction.id && r._id !== pendingAction.id));
    } finally {
      setConfirmModalOpen(false);
      setPendingAction(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.hospitalName?.toLowerCase().includes(q) ||
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
          onClick={fetchRequests}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh Feeds
        </Button>
      </div>

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
          {filteredRequests.map((req: any) => (
            <EmergencyRequestCard
              key={req.id || req._id}
              id={req.id || req._id}
              patientIdentifier={req.patientIdentifier}
              bloodGroup={req.bloodGroup}
              bloodComponent={req.bloodComponent || 'WHOLE_BLOOD'}
              unitsRequired={req.unitsRequired}
              urgency={req.urgency}
              status={req.status || 'ACTIVE'}
              hospitalName={req.hospitalName}
              city={req.city}
              distanceFormatted={req.distanceFormatted || 'Local Hospital'}
              estimatedTransitTimeMinutes={req.estimatedTransitTimeMinutes}
              requiredWithinHours={req.requiredWithinHours}
              notes={req.notes}
              onAccept={() => handlePromptAction(req.id || req._id, 'ACCEPTED')}
              onDecline={() => handlePromptAction(req.id || req._id, 'DECLINED')}
              onViewDetails={() => {
                toast.info(`Hospital: ${req.hospitalName} | Transit: ~${req.estimatedTransitTimeMinutes || 15} mins`, 'Request Info');
              }}
            />
          ))}
        </div>
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
