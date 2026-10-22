import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Activity,
  CheckCircle2,
  Users,
  ArrowRight,
  ShieldCheck,
  Clock,
  Search,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import { useSocketEvent } from '../../hooks/useSocketEvent';
import { getHospitalDashboardApi, getRegisteredDonorsApi } from '../../api/hospitalsApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  EmergencyTrendsChart,
  FulfillmentRateChart,
} from '../../components/domain/DashboardCharts';
import type { BloodGroup } from '../../types';

const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const HospitalDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { isConnected } = useSocket();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Registered Donors section state
  const [donors, setDonors] = useState<any[]>([]);
  const [isDonorsLoading, setIsDonorsLoading] = useState<boolean>(true);
  const [donorSearch, setDonorSearch] = useState<string>('');
  const [donorBloodGroup, setDonorBloodGroup] = useState<string>('ALL');
  const [donorAvailability, setDonorAvailability] = useState<string>('ALL');

  const fetchDashboard = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setIsLoading(true);
      setError(null);
      const data = await getHospitalDashboardApi();
      setDashboardData(data);
    } catch (err: unknown) {
      if (!isBackground) {
        setDashboardData(null);
        setError(err instanceof Error ? err.message : 'Failed to load hospital dashboard data.');
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  }, []);

  const fetchDonors = useCallback(async () => {
    try {
      setIsDonorsLoading(true);
      const params: Record<string, string> = {};
      if (donorBloodGroup !== 'ALL') params.bloodGroup = donorBloodGroup;
      if (donorAvailability !== 'ALL') params.isAvailable = donorAvailability;
      const data = await getRegisteredDonorsApi(params);
      setDonors(data.donors || []);
    } catch {
      setDonors([]);
    } finally {
      setIsDonorsLoading(false);
    }
  }, [donorBloodGroup, donorAvailability]);

  useEffect(() => {
    fetchDashboard(false);
  }, [fetchDashboard]);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  // Real-time socket event listeners
  useSocketEvent('donor:response', useCallback(() => {
    fetchDashboard(true);
    fetchDonors();
  }, [fetchDashboard, fetchDonors]));

  useSocketEvent('request:updated', useCallback(() => {
    fetchDashboard(true);
  }, [fetchDashboard]));

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
          fetchDashboard(true);
        }, 12000);
      }
    } else {
      clearPoll();
    }

    return clearPoll;
  }, [user, isConnected, fetchDashboard]);

  const stats = dashboardData?.dashboard?.stats || dashboardData?.stats;
  const activeRequests = stats?.activeRequestsCount ?? stats?.activeRequests ?? 0;
  const matchedDonors = stats?.totalAcceptedResponses ?? stats?.matchedDonors ?? 0;
  const fulfilledRequests = stats?.fulfilledRequestsCount ?? stats?.fulfilledRequests ?? 0;
  const cancelledRequests = stats?.cancelledRequestsCount ?? stats?.cancelledRequests ?? 0;
  const recentList = dashboardData?.dashboard?.recentRequests || dashboardData?.recentRequests || [];

  // Client-side text search filtering for registered donors directory
  const filteredDonors = donors.filter((d) => {
    if (!donorSearch) return true;
    const q = donorSearch.toLowerCase().trim();
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

  return (
    <div className="space-y-8">
      {/* Error Alert if API Fails */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-red-800">Unable to load hospital dashboard</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchDashboard(false)}>
            Retry
          </Button>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-soft">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {user?.name || 'Healthcare Emergency Facility'}
            </h1>
            {/* Verification badge: reads ONLY the authoritative HospitalProfile.isVerifiedByAdmin
                value returned by the server. Never falls back to User.isVerified, which is a
                different field and was causing newly registered hospitals to appear as Verified. */}
            {dashboardData?.dashboard?.hospital?.isVerifiedByAdmin === true ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-vitality-50 text-vitality-700 border border-vitality-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Verified Facility
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="h-3.5 w-3.5" />
                Pending Verification
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Emergency Blood Request Coordination & Real-Time Donor Dispatch Dashboard
          </p>
        </div>

        {dashboardData?.dashboard?.hospital?.isVerifiedByAdmin === true ? (
          <Link to="/hospital/requests/new">
            <Button
              size="md"
              variant="primary"
              leftIcon={<PlusCircle className="h-4 w-4" />}
              className="shadow-soft"
            >
              Create Emergency Request
            </Button>
          </Link>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <Button
              size="md"
              variant="primary"
              leftIcon={<PlusCircle className="h-4 w-4" />}
              disabled
              title="Facility verification pending. Emergency requests can be dispatched once verified by an administrator."
              className="shadow-soft opacity-60 cursor-not-allowed"
            >
              Create Emergency Request
            </Button>
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              Facility verification pending. Emergency requests can be dispatched once verified by an administrator.
            </span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Broadcasts</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-emergency-600">
                  {activeRequests}
                </span>
                <span className="text-[11px] text-emergency-700 font-semibold bg-emergency-50 px-2 py-0.5 rounded-full">
                  Urgent Live
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-emergency-50 text-emergency-600">
              <Activity className="h-6 w-6 animate-pulse" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matched Donors</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {matchedDonors}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">In vicinity</span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-clinical-50 text-clinical-600">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fulfilled Emergencies</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-vitality-600">
                  {fulfilledRequests}
                </span>
                <span className="text-[11px] text-vitality-700 font-semibold bg-vitality-50 px-2 py-0.5 rounded-full">
                  Successful
                </span>
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Donors</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-clinical-600">
                  {stats?.totalRegisteredDonors ?? donors.length}
                </span>
                <span className="text-[11px] text-clinical-700 font-semibold bg-clinical-50 px-2 py-0.5 rounded-full">
                  Platform Total
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-clinical-50 text-clinical-600">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Analytics Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmergencyTrendsChart
          title="Hospital Dispatch Trends"
          description="Emergency request volume dispatched across urgency levels"
        />
        <FulfillmentRateChart
          fulfilledCount={fulfilledRequests}
          activeCount={activeRequests}
          cancelledCount={cancelledRequests}
          avgResponseMinutes={0}
        />
      </div>

      {/* Recent Requests Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Recent Emergency Requests
            </h2>
            <p className="text-xs text-slate-500">
              Track broadcast status, donor responses, and matching progress.
            </p>
          </div>

          <Link to="/hospital/requests">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Manage All Requests
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <SkeletonTable rows={3} columns={6} />
        ) : recentList && recentList.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient / Ref</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Urgency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentList.map((req: any) => (
                <TableRow key={req.id || req._id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">
                    {req.patientIdentifier}
                  </TableCell>
                  <TableCell>
                    <Badge bloodGroup={req.bloodGroup} />
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-slate-600 uppercase">
                    {req.bloodComponent?.replace('_', ' ') || 'WHOLE BLOOD'}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">
                    {req.unitsRequired} Units
                  </TableCell>
                  <TableCell>
                    <Badge urgency={req.urgency} />
                  </TableCell>
                  <TableCell>
                    <Badge status={req.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to={`/hospital/requests/${req.id || req._id}`}>
                      <Button size="sm" variant="clinical">
                        View Matches ({req.matchedCount ?? req.totalNotified ?? 0})
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No Active Emergency Requests"
            description="Create an emergency request to immediately dispatch alerts to nearby compatible blood donors."
            actionLabel="Create Request"
            onAction={() => {}}
          />
        )}
      </div>

      {/* Registered Platform Donors Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Registered Platform Donors
              </h2>
              <span className="text-xs font-semibold bg-clinical-50 text-clinical-700 border border-clinical-200 px-2.5 py-0.5 rounded-full">
                {donors.length} Verified Donors
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Direct access to all registered voluntary blood donors across the regional platform network.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDonors}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh Donors
            </Button>
            <Link to="/hospital/donors">
              <Button variant="outline" size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Full Donor Directory
              </Button>
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-soft">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search donor by name, blood group, phone, city, or district..."
              value={donorSearch}
              onChange={(e) => setDonorSearch(e.target.value)}
              className="pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={donorBloodGroup}
              onChange={(e) => setDonorBloodGroup(e.target.value)}
              className="text-xs w-full sm:w-36 appearance-none bg-white border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-100 focus:border-clinical-500 hover:border-slate-300 transition-all"
            >
              <option value="ALL">All Blood Groups</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>

            <select
              value={donorAvailability}
              onChange={(e) => setDonorAvailability(e.target.value)}
              className="text-xs w-full sm:w-36 appearance-none bg-white border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-100 focus:border-clinical-500 hover:border-slate-300 transition-all"
            >
              <option value="ALL">All Status</option>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </select>
          </div>
        </div>

        {/* Donors Table */}
        {isDonorsLoading ? (
          <SkeletonTable rows={4} columns={7} />
        ) : filteredDonors.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-soft">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor Profile</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Supported Components</TableHead>
                  <TableHead>Location / District</TableHead>
                  <TableHead>Availability</TableHead>
                  <TableHead>Direct Contact</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDonors.slice(0, 10).map((donor: any) => {
                  const addr = donor.address;
                  const cityParts = [addr?.city, addr?.district, addr?.state].filter(Boolean);
                  const cityStr = cityParts.length > 0 ? cityParts.join(', ') : 'Location not specified';
                  const isReady = donor.isAvailable && (!donor.lastDonationDate || (donor.isEligibleToDonate ?? true));

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
                              <span className="truncate max-w-[150px]">{donor.email}</span>
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
            title="No Registered Donors Found"
            description="No donors match the current filter or search criteria."
            actionLabel="Reset Search"
            onAction={() => {
              setDonorSearch('');
              setDonorBloodGroup('ALL');
              setDonorAvailability('ALL');
            }}
          />
        )}
      </div>
    </div>
  );
};
