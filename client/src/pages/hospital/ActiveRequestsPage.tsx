import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, RefreshCw, Eye } from 'lucide-react';
import { getHospitalRequestsApi } from '../../api/hospitalsApi';
import { updateRequestStatusApi } from '../../api/requestsApi';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { RequestStatus } from '../../types';

export const ActiveRequestsPage: React.FC = () => {
  const { toast } = useToast();

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Status transition modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ id: string; status: RequestStatus } | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (selectedStatus !== 'ALL') params.status = selectedStatus;

      const data = await getHospitalRequestsApi(params);
      setRequests(data.requests || []);
    } catch (err) {
      // Fallback demo requests
      setRequests([
        {
          id: 'req-2026-001',
          patientIdentifier: 'EMERGENCY-TRAUMA-91',
          bloodGroup: 'O-',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 3,
          urgency: 'CRITICAL',
          status: 'ACTIVE',
          requiredWithinHours: 3,
          createdAt: '25 mins ago',
        },
        {
          id: 'req-2026-002',
          patientIdentifier: 'ICU-SURGICAL-02',
          bloodGroup: 'A+',
          bloodComponent: 'PLATELETS',
          unitsRequired: 2,
          urgency: 'HIGH',
          status: 'MATCHED',
          requiredWithinHours: 6,
          createdAt: '2 hours ago',
        },
        {
          id: 'req-2026-003',
          patientIdentifier: 'MATERNITY-08',
          bloodGroup: 'B+',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 1,
          urgency: 'MEDIUM',
          status: 'FULFILLED',
          requiredWithinHours: 24,
          createdAt: 'Yesterday',
        },
        {
          id: 'req-2026-004',
          patientIdentifier: 'ORTHO-TRAUMA-19',
          bloodGroup: 'AB-',
          bloodComponent: 'WHOLE_BLOOD',
          unitsRequired: 2,
          urgency: 'HIGH',
          status: 'CANCELLED',
          requiredWithinHours: 4,
          createdAt: '3 days ago',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedStatus]);

  const handlePromptStatus = (id: string, status: RequestStatus) => {
    setPendingUpdate({ id, status });
    setConfirmOpen(true);
  };

  const handleExecuteStatus = async () => {
    if (!pendingUpdate) return;
    try {
      await updateRequestStatusApi(pendingUpdate.id, pendingUpdate.status);
      toast.success(`Request status updated to ${pendingUpdate.status}`, 'Status Updated');
      setRequests((prev) =>
        prev.map((r) =>
          r.id === pendingUpdate.id || r._id === pendingUpdate.id
            ? { ...r, status: pendingUpdate.status }
            : r
        )
      );
    } catch (err) {
      toast.info(`Request marked as ${pendingUpdate.status} (simulated update).`, 'Status Updated');
      setRequests((prev) =>
        prev.map((r) =>
          r.id === pendingUpdate.id || r._id === pendingUpdate.id
            ? { ...r, status: pendingUpdate.status }
            : r
        )
      );
    } finally {
      setConfirmOpen(false);
      setPendingUpdate(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.patientIdentifier?.toLowerCase().includes(q) ||
      r.bloodGroup?.toLowerCase().includes(q) ||
      r.bloodComponent?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Emergency Requests Directory
          </h1>
          <p className="text-xs text-slate-500">
            Monitor broadcast status, potential donor matches, and lifecycle transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
          <Link to="/hospital/requests/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="h-4 w-4" />}>
              Create Request
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Search by Patient Code or Blood Group"
          placeholder="e.g. ER-TRAUMA, O-"
          leftIcon={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Select
          label="Filter by Status"
          options={[
            { value: 'ALL', label: 'All Lifecycle Statuses' },
            { value: 'ACTIVE', label: 'ACTIVE (Broadcasting)' },
            { value: 'MATCHED', label: 'MATCHED (Donors Responding)' },
            { value: 'FULFILLED', label: 'FULFILLED (Completed)' },
            { value: 'CANCELLED', label: 'CANCELLED' },
            { value: 'EXPIRED', label: 'EXPIRED' },
          ]}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={4} columns={7} />
      ) : filteredRequests.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case Identifier</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Component</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Urgency</TableHead>
              <TableHead>Lifecycle Status</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.map((req: any) => {
              const reqId = req.id || req._id;
              const isTerminal = req.status === 'FULFILLED' || req.status === 'CANCELLED' || req.status === 'EXPIRED';

              return (
                <TableRow key={reqId}>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">
                    {req.patientIdentifier}
                  </TableCell>
                  <TableCell>
                    <Badge bloodGroup={req.bloodGroup} />
                  </TableCell>
                  <TableCell className="text-xs font-semibold uppercase text-slate-600">
                    {req.bloodComponent?.replace('_', ' ') || 'WHOLE BLOOD'}
                  </TableCell>
                  <TableCell className="font-bold text-slate-800">
                    {req.unitsRequired} Units
                  </TableCell>
                  <TableCell>
                    <Badge urgency={req.urgency} />
                  </TableCell>
                  <TableCell>
                    <Badge status={req.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link to={`/hospital/requests/${reqId}`}>
                        <Button size="sm" variant="clinical" leftIcon={<Eye className="h-3.5 w-3.5" />}>
                          Matches
                        </Button>
                      </Link>

                      {!isTerminal && (
                        <>
                          <Button
                            size="sm"
                            variant="vitality"
                            onClick={() => handlePromptStatus(reqId, 'FULFILLED')}
                          >
                            Fulfill
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePromptStatus(reqId, 'CANCELLED')}
                            className="text-emergency-600 hover:text-emergency-700"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="No Emergency Requests Match"
          description="There are no emergency requests matching your search or selected filter status."
          actionLabel="Clear Filters"
          onAction={() => {
            setSelectedStatus('ALL');
            setSearchQuery('');
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecuteStatus}
        title={pendingUpdate?.status === 'FULFILLED' ? 'Fulfill Request' : 'Cancel Request'}
        message={
          pendingUpdate?.status === 'FULFILLED'
            ? 'Confirm that all required blood units have been collected and verified on-site by clinical staff?'
            : 'Are you sure you wish to cancel this emergency request? Connected donors will be notified.'
        }
        confirmText={pendingUpdate?.status === 'FULFILLED' ? 'Mark as Fulfilled' : 'Confirm Cancel'}
        variant={pendingUpdate?.status === 'FULFILLED' ? 'info' : 'danger'}
      />
    </div>
  );
};
