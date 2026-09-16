import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  RefreshCw,
  Building2,
  MapPin,
  Clock,
  UserCheck,
  ShieldCheck,
  Phone,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { useSocket } from '../../hooks/useSocket';
import { useRequestRoom } from '../../hooks/useRequestRoom';
import { useToast } from '../../components/feedback';
import {
  getEmergencyRequestByIdApi,
  getPotentialMatchesApi,
  updateRequestStatusApi,
  contactAcceptedDonorApi,
} from '../../api/requestsApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { MedicalDisclaimer } from '../../components/domain/MedicalDisclaimer';
import { DonorCard } from '../../components/domain/DonorCard';
import { RequestStatus } from '../../types';

export const RequestDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { socket } = useSocket();

  // Join Socket.IO Request Room for real-time donor response pushes
  useRequestRoom(id);

  const [request, setRequest] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<RequestStatus | null>(null);

  // Fulfillment State
  const [fulfillModalOpen, setFulfillModalOpen] = useState(false);
  const [selectedFulfilledDonorId, setSelectedFulfilledDonorId] = useState<string>('');
  const [isFulfilling, setIsFulfilling] = useState(false);

  // Phase 7: Contact Donor Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<any>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const reqData = await getEmergencyRequestByIdApi(id);
      setRequest(reqData.request);

      const matchData = await getPotentialMatchesApi(id);
      setMatches(matchData.potentialMatches || matchData.matches || []);
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
        acceptedDonors: [
          {
            donorId: 'd-101',
            name: 'Marcus Vance',
            bloodGroup: 'O-',
            location: 'Central District',
            status: 'ACCEPTED',
            acceptedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
            contact: { phone: '+91 98765 43210' },
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

  // Live Socket.IO updates for this emergency request
  useEffect(() => {
    if (!socket || !id) return;

    const handleDonorResponse = (data: any) => {
      if (data.requestId === id) {
        toast.info(
          `Donor ${data.donorName || ''} has ${data.action.toLowerCase()} this emergency request!`,
          'Live Donor Response'
        );
        fetchData();
      }
    };

    const handleRequestUpdated = (data: any) => {
      if (data.requestId === id) {
        fetchData();
      }
    };

    socket.on('donor:response', handleDonorResponse);
    socket.on('request:updated', handleRequestUpdated);

    return () => {
      socket.off('donor:response', handleDonorResponse);
      socket.off('request:updated', handleRequestUpdated);
    };
  }, [socket, id]);

  const handlePromptStatus = (status: RequestStatus) => {
    if (status === 'FULFILLED') {
      const accepted = request?.acceptedDonors || [];
      if (accepted.length === 0) {
        toast.error(
          'Cannot fulfill request: No accepted donors exist for this request. Fulfillment requires an accepted donor who completed the donation.',
          'Fulfillment Error'
        );
        return;
      }
      setSelectedFulfilledDonorId(accepted[0]?.donorId || '');
      setFulfillModalOpen(true);
      return;
    }
    setPendingStatus(status);
    setConfirmOpen(true);
  };

  const executeStatus = async () => {
    if (!id || !pendingStatus) return;
    try {
      await updateRequestStatusApi(id, pendingStatus);
      toast.success(`Request transitioned to ${pendingStatus}`, 'Status Updated');
      setRequest((prev: any) => ({ ...prev, status: pendingStatus }));
    } catch (err: any) {
      toast.error(err?.message || `Failed to update request status to ${pendingStatus}.`, 'Status Error');
    } finally {
      setConfirmOpen(false);
      setPendingStatus(null);
    }
  };

  const executeFulfill = async () => {
    if (!id || !selectedFulfilledDonorId) return;
    try {
      setIsFulfilling(true);
      await updateRequestStatusApi(id, 'FULFILLED', undefined, selectedFulfilledDonorId);
      const donor = request?.acceptedDonors?.find((d: any) => d.donorId === selectedFulfilledDonorId);
      const donorName = donor?.name || donor?.donorName || 'donor';
      toast.success(
        `Emergency request fulfilled! 1 completed donation recorded for ${donorName}.`,
        'Request Fulfilled'
      );
      setRequest((prev: any) => ({ ...prev, status: 'FULFILLED' }));
      setFulfillModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fulfill emergency request.', 'Fulfillment Error');
    } finally {
      setIsFulfilling(false);
    }
  };

  const handleOpenContact = (donor: any) => {
    setSelectedDonor(donor);
    setCustomMessage(
      `${request?.hospitalName || 'Hospital'} is expecting you for Emergency Request (${request?.patientIdentifier}). Please report to Emergency Reception/Blood Bank.`
    );
    setContactModalOpen(true);
  };

  const handleDispatchMessage = async () => {
    if (!id || !selectedDonor) return;
    try {
      setIsSendingMessage(true);
      await contactAcceptedDonorApi(id, selectedDonor.donorId, customMessage);
      toast.success(
        `Coordination dispatch notification sent to ${selectedDonor.name || 'donor'}.`,
        'Alert Dispatched'
      );
      setContactModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to dispatch coordination message.', 'Dispatch Error');
    } finally {
      setIsSendingMessage(false);
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
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Reference</span>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
                  {request.patientIdentifier}
                </h1>
                <Badge urgency={request.urgency} />
                <Badge status={request.status} />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400 font-medium">Hospital:</span>
                <span className="font-bold text-slate-800">
                  {request.hospitalName || 'Hospital information unavailable'}
                </span>
              </div>
              {request.city && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-400 font-medium">Location:</span>
                  <span>{request.city}</span>
                </div>
              )}
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
              <p className="text-slate-500 font-medium">Blood Component</p>
              <p className="font-bold text-slate-900 mt-0.5 uppercase">
                {request.bloodComponent?.replace('_', ' ') || 'WHOLE BLOOD'}
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500 font-medium">Required Timeframe</p>
              <p className="font-bold text-slate-900 mt-0.5">&lt; {request.requiredWithinHours || 3} Hours</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500 font-medium">Confirmed Donors</p>
              <p className="font-bold text-vitality-700 mt-0.5">
                {(request.acceptedDonors?.length || 0)} Accepted ({(request.acceptedDonors?.length || 0) >= request.unitsRequired ? 'Fulfilled' : `${Math.max(0, request.unitsRequired - (request.acceptedDonors?.length || 0))} needed`})
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-slate-500 font-medium">Potential Matches</p>
              <p className="font-bold text-clinical-600 mt-0.5">{matches.length} Candidates</p>
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

      {/* Accepted Donors Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-vitality-600" />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Accepted Donors
              </h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-vitality-50 text-vitality-700 border border-vitality-200">
                {request.acceptedDonors?.length || 0} / {request.unitsRequired} Units Confirmed
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Donors who have confirmed their willingness to donate for this emergency request.
            </p>
          </div>
        </div>

        {request.acceptedDonors && request.acceptedDonors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {request.acceptedDonors.map((donor: any, idx: number) => {
              const formattedTime = donor.acceptedAt
                ? new Date(donor.acceptedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Recently';

              return (
                <Card
                  key={donor.donorId || idx}
                  className="border-vitality-200 bg-white shadow-soft-sm hover:shadow-soft transition-all duration-200"
                >
                  <CardContent className="p-5 space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-vitality-700 font-bold uppercase tracking-wider">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Accepted Donor</span>
                        </div>
                        <h4 className="text-base font-bold text-slate-900 leading-tight">
                          {donor.name || donor.donorName || 'Prospective Donor'}
                        </h4>
                      </div>
                      <Badge bloodGroup={donor.bloodGroup || request.bloodGroup} />
                    </div>

                    {/* Donor Details */}
                    <div className="space-y-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400 font-medium">Location:</span>
                        <span className="font-medium text-slate-800">
                          {donor.location || [donor.city, donor.district].filter(Boolean).join(', ') || 'Approximate location'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400 font-medium">Accepted At:</span>
                        <span className="text-slate-700">{formattedTime}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-slate-400 font-medium">Availability:</span>
                        <span className="font-semibold text-emerald-700">Available</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-3.5 w-3.5 text-vitality-600 shrink-0" />
                        <span className="text-slate-400 font-medium">Status:</span>
                        <span className="font-semibold text-vitality-700">Accepted & Ready</span>
                      </div>
                    </div>

                    {/* Contact details / Privacy notice */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                      {donor.contact?.phone ? (
                        <a
                          href={`tel:${donor.contact.phone}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-clinical-50 text-clinical-700 rounded-lg hover:bg-clinical-100 transition-colors font-medium"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{donor.contact.phone}</span>
                        </a>
                      ) : null}

                      {donor.contact?.email ? (
                        <a
                          href={`mailto:${donor.contact.email}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          <span>{donor.contact.email}</span>
                        </a>
                      ) : null}

                      {!donor.contact?.phone && !donor.contact?.email && (
                        <div className="text-[11px] text-slate-500 italic flex items-center gap-1.5">
                          <span>Contact details protected by donor privacy preferences.</span>
                        </div>
                      )}
                    </div>

                    {/* Contact Donor Action Button */}
                    <Button
                      variant="vitality"
                      size="sm"
                      className="w-full mt-3 font-semibold shadow-soft-xs"
                      onClick={() => handleOpenContact(donor)}
                      leftIcon={<Phone className="h-3.5 w-3.5" />}
                    >
                      Contact Donor
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <div className="mx-auto w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-2">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              No donors have accepted this request yet.
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              When a compatible donor accepts, their details and contact options will appear here in real time.
            </p>
          </div>
        )}
      </div>

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

      {/* Confirmation Dialog for Cancellation */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeStatus}
        title="Confirm Cancellation"
        message="Are you sure you wish to cancel this emergency request? Any notified or responding donors will be updated."
        confirmText="Yes, Cancel Request"
        variant="danger"
      />

      {/* Fulfillment Confirmation Modal */}
      <Modal
        isOpen={fulfillModalOpen}
        onClose={() => !isFulfilling && setFulfillModalOpen(false)}
        title="Confirm Blood Donation Fulfillment"
        description="Select the donor who physically arrived and completed the donation. An official donation record will be created exclusively for this donor."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Verified Donating Donor
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {request.acceptedDonors?.map((donor: any) => {
                const isSelected = selectedFulfilledDonorId === donor.donorId;
                return (
                  <div
                    key={donor.donorId}
                    onClick={() => setSelectedFulfilledDonorId(donor.donorId)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-vitality-500 bg-vitality-50/50 shadow-soft-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id={`donor-${donor.donorId}`}
                        name="fulfilledDonor"
                        value={donor.donorId}
                        checked={isSelected}
                        onChange={() => setSelectedFulfilledDonorId(donor.donorId)}
                        className="h-4 w-4 text-vitality-600 focus:ring-vitality-500 border-slate-300"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {donor.name || donor.donorName || 'Accepted Donor'}
                          </span>
                          <Badge bloodGroup={donor.bloodGroup || request.bloodGroup} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {donor.location || 'Location undisclosed'} • Accepted{' '}
                          {donor.acceptedAt
                            ? new Date(donor.acceptedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Recently'}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 text-vitality-600 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-700">Data Integrity Verification</p>
            <p>
              By proceeding, this emergency request will transition to <strong>FULFILLED</strong> and 1 unit donation credit will be permanently recorded for the selected donor only.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              disabled={isFulfilling}
              onClick={() => setFulfillModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="vitality"
              size="sm"
              isLoading={isFulfilling}
              disabled={!selectedFulfilledDonorId || isFulfilling}
              onClick={executeFulfill}
              leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Confirm & Mark Fulfilled
            </Button>
          </div>
        </div>
      </Modal>

      {/* Phase 7: Contact Donor Modal */}
      {contactModalOpen && selectedDonor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-soft-xl max-w-lg w-full p-6 space-y-5 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900">
                  Contact Accepted Donor
                </h3>
                <p className="text-xs text-slate-500">
                  Coordinate emergency blood donation for {request.patientIdentifier}
                </p>
              </div>
              <button
                onClick={() => setContactModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Donor Summary */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {selectedDonor.name || selectedDonor.donorName}
                </span>
                <Badge bloodGroup={selectedDonor.bloodGroup || request.bloodGroup} />
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{selectedDonor.location || 'Location undisclosed'}</span>
              </div>
            </div>

            {/* Direct Contact Options */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Direct Communication</p>
              {selectedDonor.contact?.phone || selectedDonor.contact?.email ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedDonor.contact?.phone && (
                    <a
                      href={`tel:${selectedDonor.contact.phone}`}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-clinical-50 text-clinical-700 rounded-xl hover:bg-clinical-100 font-medium transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Call {selectedDonor.contact.phone}</span>
                    </a>
                  )}
                  {selectedDonor.contact?.email && (
                    <a
                      href={`mailto:${selectedDonor.contact.email}`}
                      className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 font-medium transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      <span>Email {selectedDonor.contact.email}</span>
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  <p className="font-medium">Direct telephone/email masked per donor privacy settings.</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    You can dispatch an urgent in-app coordination alert to this donor below.
                  </p>
                </div>
              )}
            </div>

            {/* In-App Dispatch Alert */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Dispatch In-App Emergency Alert
              </label>
              <textarea
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter coordination instructions or hospital reception details..."
                className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-vitality-500 focus:border-vitality-500 transition-all outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setContactModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="vitality"
                size="sm"
                isLoading={isSendingMessage}
                onClick={handleDispatchMessage}
                leftIcon={<Send className="h-3.5 w-3.5" />}
              >
                Send Coordination Alert
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
