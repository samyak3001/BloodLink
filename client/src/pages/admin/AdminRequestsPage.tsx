import React, { useEffect, useState } from 'react';
import {
  Search,
  Eye,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { getEmergencyRequestsApi } from '../../api/requestsApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { RequestUrgency, RequestStatus } from '../../types';

export const AdminRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');

  // Inspection modal state
  const [inspectingRequest, setInspectingRequest] = useState<any | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (selectedUrgency !== 'ALL') params.urgency = selectedUrgency;
      if (selectedStatus !== 'ALL') params.status = selectedStatus;
      if (selectedBloodGroup !== 'ALL') params.bloodGroup = selectedBloodGroup;

      const data = await getEmergencyRequestsApi(params);
      setRequests(data.data || []);
    } catch (err) {
      console.error('Failed to load emergency requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedUrgency, selectedStatus, selectedBloodGroup]);

  // Client-side search filtering by hospital name or patient reference
  const filteredRequests = requests.filter((req) => {
    const term = searchTerm.toLowerCase();
    const patientMatch = req.patientIdentifier?.toLowerCase().includes(term);
    const hospitalMatch = req.hospitalId?.hospitalName?.toLowerCase().includes(term);
    return patientMatch || hospitalMatch;
  });

  const getUrgencyBadge = (urgency: RequestUrgency) => {
    switch (urgency) {
      case 'CRITICAL':
        return <Badge variant="emergency">CRITICAL</Badge>;
      case 'HIGH':
        return <Badge variant="vitality">HIGH</Badge>;
      case 'MEDIUM':
        return <Badge variant="clinical">MEDIUM</Badge>;
      default:
        return <Badge>{urgency}</Badge>;
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="emergency">ACTIVE</Badge>;
      case 'MATCHED':
        return <Badge variant="clinical">MATCHED</Badge>;
      case 'FULFILLED':
        return <Badge variant="vitality">FULFILLED</Badge>;
      case 'CANCELLED':
        return <Badge variant="default">CANCELLED</Badge>;
      case 'EXPIRED':
        return <Badge variant="default">EXPIRED</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-soft-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Emergency Blood Requests Oversight
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emergency-50 text-emergency-700 border border-emergency-200">
              System-Wide
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Audit, track, and supervise emergency broadcasts dispatched across all regional facilities.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchRequests}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh Feed
        </Button>
      </div>

      {/* Search & Multi-Filter Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Input
                placeholder="Search hospital or patient ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="h-4 w-4 text-slate-400" />}
              />
            </div>

            {/* Urgency Filter */}
            <Select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Urgencies' },
                { value: 'CRITICAL', label: 'Critical Urgency' },
                { value: 'HIGH', label: 'High Urgency' },
                { value: 'MEDIUM', label: 'Medium Urgency' },
              ]}
            />

            {/* Status Filter */}
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active Broadcasts' },
                { value: 'MATCHED', label: 'Matched Candidates' },
                { value: 'FULFILLED', label: 'Fulfilled' },
                { value: 'CANCELLED', label: 'Cancelled' },
                { value: 'EXPIRED', label: 'Expired' },
              ]}
            />

            {/* Blood Group Filter */}
            <Select
              value={selectedBloodGroup}
              onChange={(e) => setSelectedBloodGroup(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Blood Groups' },
                { value: 'O-', label: 'O- (Universal Donor)' },
                { value: 'O+', label: 'O+' },
                { value: 'A-', label: 'A-' },
                { value: 'A+', label: 'A+' },
                { value: 'B-', label: 'B-' },
                { value: 'B+', label: 'B+' },
                { value: 'AB-', label: 'AB-' },
                { value: 'AB+', label: 'AB+ (Universal Recipient)' },
              ]}
            />
          </div>

          {(searchTerm || selectedUrgency !== 'ALL' || selectedStatus !== 'ALL' || selectedBloodGroup !== 'ALL') && (
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
              <span className="text-slate-500">
                Filtered: <strong>{filteredRequests.length}</strong> matching records
              </span>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedUrgency('ALL');
                  setSelectedStatus('ALL');
                  setSelectedBloodGroup('ALL');
                }}
                className="text-clinical-600 font-semibold hover:underline"
              >
                Reset Filters
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requests Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={7} />
      ) : filteredRequests.length > 0 ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient / Ref</TableHead>
                <TableHead>Hospital Facility</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispatched</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((req) => (
                <TableRow key={req._id}>
                  <TableCell className="font-bold text-slate-900">
                    {req.patientIdentifier}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-slate-700">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[160px]">
                        {req.hospitalId?.hospitalName || 'Verified Facility'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-0.5 rounded-md bg-emergency-50 text-emergency-700 font-extrabold text-xs">
                      {req.bloodGroup}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-400">
                      {req.bloodComponent || 'Whole'}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    {req.unitsRequired} {req.unitsRequired === 1 ? 'unit' : 'units'}
                  </TableCell>
                  <TableCell>{getUrgencyBadge(req.urgency)}</TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell className="text-slate-500 text-[11px]">
                    {new Date(req.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setInspectingRequest(req)}
                      leftIcon={<Eye className="h-3.5 w-3.5" />}
                    >
                      Audit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          title="No Emergency Requests Match Filters"
          description="Try broadening your search term, changing urgency criteria, or clearing selected blood group filters."
          actionLabel="Clear All Filters"
          onAction={() => {
            setSearchTerm('');
            setSelectedUrgency('ALL');
            setSelectedStatus('ALL');
            setSelectedBloodGroup('ALL');
          }}
        />
      )}

      {/* Inspection Modal */}
      {inspectingRequest && (
        <Modal
          isOpen={true}
          onClose={() => setInspectingRequest(null)}
          title={`Emergency Request: ${inspectingRequest.patientIdentifier}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-slate-400 font-medium">Hospital Facility</p>
                <p className="font-bold text-slate-900">
                  {inspectingRequest.hospitalId?.hospitalName || 'Verified Medical Facility'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Emergency Helpline</p>
                <p className="font-bold text-slate-900">
                  {inspectingRequest.hospitalId?.emergencyHelpline || 'Clinical Dispatch Line'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Required Within</p>
                <p className="font-bold text-slate-900">
                  {inspectingRequest.requiredWithinHours} hours
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Search Radius</p>
                <p className="font-bold text-slate-900">
                  {inspectingRequest.maxRadiusKm || 25} km
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900">Clinical Request Details</h4>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-600">Urgency:</span>
                {getUrgencyBadge(inspectingRequest.urgency)}
                <span className="font-semibold text-slate-600 ml-2">Status:</span>
                {getStatusBadge(inspectingRequest.status)}
              </div>
              <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {inspectingRequest.notes || 'No extra clinical notes provided for this dispatch.'}
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInspectingRequest(null)}
              >
                Close Audit Viewer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
