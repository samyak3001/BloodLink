import React, { useEffect, useState } from 'react';
import { Building2, ShieldCheck, ShieldAlert, CheckCircle2, Search, RefreshCw } from 'lucide-react';
import { getAdminUsersApi, verifyHospitalApi } from '../../api/adminApi';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';

const getHospitalId = (h: any): string => {
  if (!h) return '';
  return String(h._id || h.id || h.hospitalProfileId || '');
};

export const AdminHospitalsPage: React.FC = () => {
  const { toast } = useToast();

  const [hospitals, setHospitals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Verification modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [targetHospital, setTargetHospital] = useState<any | null>(null);
  const [targetAction, setTargetAction] = useState<boolean>(true);
  const [adminNotes, setAdminNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchHospitals = async () => {
    try {
      setIsLoading(true);
      const data = await getAdminUsersApi({ role: 'HOSPITAL' });
      setHospitals(data.users || []);
    } catch (err) {
      // Fallback demo hospitals with consistent unique identity keys
      setHospitals([
        {
          _id: 'h-1',
          id: 'h-1',
          hospitalProfileId: 'hp-1',
          hospitalName: 'Apollo Emergency Trauma Center',
          name: 'Apollo Emergency Trauma Center',
          email: 'apollo@bloodlink.org',
          licenseNumber: 'HOSP-LIC-1002',
          city: 'Central Metropolis',
          isVerified: true,
          isVerifiedByAdmin: true,
          createdAt: '2026-03-10',
        },
        {
          _id: 'h-2',
          id: 'h-2',
          hospitalProfileId: 'hp-2',
          hospitalName: 'St. Jude Heart & Trauma Institute',
          name: 'St. Jude Heart & Trauma Institute',
          email: 'stjude@bloodlink.org',
          licenseNumber: 'HOSP-LIC-8819',
          city: 'Metro West Corridor',
          isVerified: true,
          isVerifiedByAdmin: true,
          createdAt: '2026-04-14',
        },
        {
          _id: 'h-3',
          id: 'h-3',
          hospitalProfileId: 'hp-3',
          hospitalName: 'City Care Emergency Hospital',
          name: 'City Care Emergency Hospital',
          email: 'citycare@example.com',
          licenseNumber: 'HOSP-LIC-4491',
          city: 'East Health Hub',
          isVerified: false,
          isVerifiedByAdmin: false,
          createdAt: '2026-08-30',
        },
        {
          _id: 'h-4',
          id: 'h-4',
          hospitalProfileId: 'hp-4',
          hospitalName: 'Green Valley Community Clinic',
          name: 'Green Valley Community Clinic',
          email: 'greenvalley@example.com',
          licenseNumber: 'CLINIC-LIC-002',
          city: 'Valley Region',
          isVerified: false,
          isVerifiedByAdmin: false,
          createdAt: '2026-09-01',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  const openVerificationModal = (hospital: any, verify: boolean) => {
    setTargetHospital(hospital);
    setTargetAction(verify);
    setAdminNotes(verify ? 'Verified against state medical health registry database.' : '');
    setModalOpen(true);
  };

  const handleExecuteVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetHospital) return;

    const targetId = getHospitalId(targetHospital);
    if (!targetId) {
      toast.error('Unable to resolve a valid hospital identifier.', 'Verification Error');
      return;
    }

    try {
      setIsSubmitting(true);
      await verifyHospitalApi(targetId, targetAction, adminNotes);

      const facilityName = targetHospital.hospitalName || targetHospital.name || 'Facility';
      toast.success(
        `Facility "${facilityName}" has been ${targetAction ? 'verified' : 'unverified'}.`,
        'Verification Updated'
      );

      // Explicitly update ONLY the selected hospital record in state by unique ID
      setHospitals((prev) =>
        prev.map((h) => {
          const hId = getHospitalId(h);
          const isTarget =
            Boolean(targetId) &&
            (hId === targetId ||
              (Boolean(targetHospital._id) && (h._id === targetHospital._id || h.id === targetHospital._id)) ||
              (Boolean(targetHospital.hospitalProfileId) &&
                h.hospitalProfileId &&
                h.hospitalProfileId === targetHospital.hospitalProfileId));

          if (isTarget) {
            return {
              ...h,
              isVerified: targetAction,
              isVerifiedByAdmin: targetAction,
            };
          }
          return h;
        })
      );
    } catch (err: any) {
      toast.error(
        err.message || `Failed to update verification status for ${targetHospital.hospitalName || targetHospital.name || 'facility'}.`,
        'Verification Error'
      );
    } finally {
      setIsSubmitting(false);
      setModalOpen(false);
      setTargetHospital(null);
    }
  };

  const filteredHospitals = hospitals.filter((h) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const facilityName = (h.hospitalName || h.name || '').toLowerCase();
    return (
      facilityName.includes(q) ||
      (h.email && h.email.toLowerCase().includes(q)) ||
      (h.city && h.city.toLowerCase().includes(q)) ||
      (h.licenseNumber && h.licenseNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Hospital Verification Management
          </h1>
          <p className="text-xs text-slate-500">
            Review and grant emergency blood dispatch authority to registered healthcare facilities.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchHospitals}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm">
        <Input
          label="Search by Facility Name, License Number, or City"
          placeholder="e.g. Apollo, HOSP-LIC-1002, Metropolis"
          leftIcon={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={4} columns={5} />
      ) : filteredHospitals.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Facility Name</TableHead>
              <TableHead>Official Contact</TableHead>
              <TableHead>License Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Verification Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredHospitals.map((h: any) => {
              const hId = getHospitalId(h);
              const isVerified = h.isVerified === true || h.isVerifiedByAdmin === true;
              const facilityName = h.hospitalName || h.name || 'Healthcare Facility';

              return (
                <TableRow key={hId}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-clinical-50 text-clinical-600">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{facilityName}</p>
                        <p className="text-[11px] text-slate-500">{h.city || 'Metropolis'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 font-medium">
                    {h.email}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-800 font-semibold">
                    {h.licenseNumber || 'HOSP-PENDING'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isVerified
                          ? 'bg-vitality-50 text-vitality-700 border border-vitality-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isVerified ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Verified
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3 w-3" />
                          Pending Review
                        </>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {isVerified ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openVerificationModal(h, false)}
                        className="text-emergency-600 hover:text-emergency-700"
                      >
                        Revoke Verification
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="vitality"
                        onClick={() => openVerificationModal(h, true)}
                        leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
                      >
                        Verify Facility
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="No Hospital Records Found"
          description="There are no hospitals matching your search query."
          actionLabel="Clear Search"
          onAction={() => setSearchQuery('')}
        />
      )}

      {/* Verification Action Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={targetAction ? 'Verify Healthcare Facility' : 'Revoke Verification Status'}
        description={`Confirm administrative decision for ${targetHospital?.hospitalName || targetHospital?.name || 'facility'}`}
      >
        <form onSubmit={handleExecuteVerification} className="space-y-4 pt-2">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <p className="font-bold text-slate-900">{targetHospital?.hospitalName || targetHospital?.name}</p>
            <p className="text-slate-500">License: {targetHospital?.licenseNumber || 'N/A'}</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Administrative Compliance Notes (Required for Audit Trail)
            </label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Cross-checked with state registry. License active through 2028."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-clinical-500 focus:border-transparent"
              required
            />
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={targetAction ? 'vitality' : 'destructive'}
              size="sm"
              isLoading={isSubmitting}
            >
              {targetAction ? 'Authorize Verification' : 'Revoke Status'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
