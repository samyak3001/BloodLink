import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { getRegisteredDonorsApi } from '../../api/hospitalsApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/feedback';
import { BloodGroup } from '../../types';

export const HospitalDonorsPage: React.FC = () => {
  const { toast } = useToast();

  const [donors, setDonors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string>('ALL');
  const [selectedAvailability, setSelectedAvailability] = useState<string>('ALL');

  const fetchDonors = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string> = {};
      if (selectedBloodGroup !== 'ALL') params.bloodGroup = selectedBloodGroup;
      if (selectedAvailability !== 'ALL') params.isAvailable = selectedAvailability;

      const data = await getRegisteredDonorsApi(params);
      setDonors(data.donors || []);
    } catch (err: unknown) {
      setDonors([]);
      const msg = err instanceof Error ? err.message : 'Failed to fetch registered donors directory.';
      toast.error(msg, 'Data Load Error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedBloodGroup, selectedAvailability]);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  // Client-side text search filtering
  const filteredDonors = donors.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    const name = (d.name || '').toLowerCase();
    const email = (d.email || '').toLowerCase();
    const phone = (d.phone || '').toLowerCase();
    const bg = (d.bloodGroup || '').toLowerCase();
    const city = (d.address?.city || '').toLowerCase();
    const district = (d.address?.district || '').toLowerCase();
    const state = (d.address?.state || '').toLowerCase();

    return (
      name.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      bg.includes(q) ||
      city.includes(q) ||
      district.includes(q) ||
      state.includes(q)
    );
  });

  const availableCount = donors.filter((d) => d.isAvailable).length;
  const totalCount = donors.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Registered Donors Directory
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-clinical-50 text-clinical-700 border border-clinical-200">
              <Users className="h-3.5 w-3.5" />
              {totalCount} Donors
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Certified platform blood donors registered for voluntary transfusion coordination.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDonors}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh List
          </Button>
          <Link to="/hospital/requests/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
            >
              New Emergency Request
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Platform Donors</p>
              <p className="text-2xl font-black text-slate-900">{totalCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-clinical-50 text-clinical-600">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active & Ready Donors</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-vitality-600">{availableCount}</span>
                <span className="text-[11px] font-semibold text-vitality-700 bg-vitality-50 px-2 py-0.5 rounded-full">
                  Available
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-vitality-50 text-vitality-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resting / Inactive</p>
              <p className="text-2xl font-black text-slate-500">{totalCount - availableCount}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-100 text-slate-500">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search donors by name, blood group, city, district..."
              leftIcon={<Search className="h-4 w-4 text-slate-400" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Select
              className="w-40"
              value={selectedBloodGroup}
              onChange={(e) => setSelectedBloodGroup(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Blood Groups' },
                { value: 'O+', label: 'O+ Positive' },
                { value: 'O-', label: 'O- Universal' },
                { value: 'A+', label: 'A+ Positive' },
                { value: 'A-', label: 'A- Negative' },
                { value: 'B+', label: 'B+ Positive' },
                { value: 'B-', label: 'B- Negative' },
                { value: 'AB+', label: 'AB+ Universal Recipient' },
                { value: 'AB-', label: 'AB- Negative' },
              ]}
            />

            <Select
              className="w-36"
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Availability' },
                { value: 'true', label: 'Ready to Donate' },
                { value: 'false', label: 'Paused / Resting' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Donors Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : filteredDonors.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor Information</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Supported Components</TableHead>
                <TableHead>Location / District</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Contact Details</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDonors.map((donor) => {
                const isReady = donor.isAvailable;
                const cityStr = donor.cityFormatted || 'Location not specified';

                return (
                  <TableRow key={donor.id || donor.donorId}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm">
                            {donor.name}
                          </span>
                          {donor.isVerified && (
                            <span title="Verified platform account">
                              <ShieldCheck className="h-4 w-4 text-vitality-600" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Registered: {donor.registeredAt ? new Date(donor.registeredAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Verified'}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge bloodGroup={donor.bloodGroup as BloodGroup} />
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(donor.supportedComponents || ['WHOLE_BLOOD']).map((comp: string) => (
                          <span
                            key={comp}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700"
                          >
                            {comp.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{cityStr}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {isReady ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-vitality-50 text-vitality-700 border border-vitality-200">
                          <span className="h-2 w-2 rounded-full bg-vitality-500 animate-pulse" />
                          Ready to Donate
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          Resting / Paused
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1 text-xs">
                        {donor.phone && donor.phone !== 'N/A' && (
                          <a
                            href={`tel:${donor.phone}`}
                            className="flex items-center gap-1 text-slate-700 hover:text-clinical-600 font-medium transition-colors"
                          >
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{donor.phone}</span>
                          </a>
                        )}
                        {donor.email && donor.email !== 'N/A' && (
                          <a
                            href={`mailto:${donor.email}`}
                            className="flex items-center gap-1 text-slate-500 hover:text-clinical-600 transition-colors"
                          >
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate max-w-[180px]">{donor.email}</span>
                          </a>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <Link to="/hospital/requests/new">
                        <Button
                          size="sm"
                          variant="outline"
                          className="hover:border-emergency-300 hover:text-emergency-700 hover:bg-emergency-50"
                        >
                          Request Blood
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title="No Donors Matching Query"
          description="Try adjusting your search criteria, blood group selection, or availability filter."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedBloodGroup('ALL');
            setSelectedAvailability('ALL');
          }}
        />
      )}
    </div>
  );
};

export default HospitalDonorsPage;
