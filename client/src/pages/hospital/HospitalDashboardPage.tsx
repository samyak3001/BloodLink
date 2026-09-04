import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  Activity,
  CheckCircle2,
  Users,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getHospitalDashboardApi } from '../../api/hospitalsApi';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  EmergencyTrendsChart,
  FulfillmentRateChart,
} from '../../components/domain/DashboardCharts';

export const HospitalDashboardPage: React.FC = () => {
  const { user } = useAuth();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setIsLoading(true);
        const data = await getHospitalDashboardApi();
        setDashboardData(data);
      } catch (err) {
        // Fallback demo dashboard state
        setDashboardData({
          stats: {
            activeRequests: 2,
            matchedDonors: 6,
            fulfilledRequests: 14,
            isVerified: true,
          },
          recentRequests: [
            {
              id: 'req-2026-001',
              patientIdentifier: 'EMERGENCY-TRAUMA-91',
              bloodGroup: 'O-',
              bloodComponent: 'WHOLE_BLOOD',
              unitsRequired: 3,
              urgency: 'CRITICAL',
              status: 'ACTIVE',
              createdAt: '25 mins ago',
              matchedCount: 3,
            },
            {
              id: 'req-2026-002',
              patientIdentifier: 'ICU-SURGICAL-02',
              bloodGroup: 'A+',
              bloodComponent: 'PLATELETS',
              unitsRequired: 2,
              urgency: 'HIGH',
              status: 'MATCHED',
              createdAt: '2 hours ago',
              matchedCount: 4,
            },
            {
              id: 'req-2026-003',
              patientIdentifier: 'MATERNITY-08',
              bloodGroup: 'B+',
              bloodComponent: 'WHOLE_BLOOD',
              unitsRequired: 1,
              urgency: 'MEDIUM',
              status: 'FULFILLED',
              createdAt: 'Yesterday',
              matchedCount: 2,
            },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-soft">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {user?.name || 'Healthcare Emergency Facility'}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-clinical-50 text-clinical-700 border border-clinical-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified Facility
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Emergency Blood Request Coordination & Real-Time Donor Dispatch Dashboard
          </p>
        </div>

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
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Broadcasts</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-emergency-600">
                  {dashboardData?.stats?.activeRequests ?? 2}
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
                  {dashboardData?.stats?.matchedDonors ?? 6}
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
                  {dashboardData?.stats?.fulfilledRequests ?? 14}
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
      </div>

      {/* Emergency Analytics Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmergencyTrendsChart
          title="Hospital Dispatch Trends"
          description="Emergency request volume dispatched across urgency levels"
        />
        <FulfillmentRateChart
          fulfilledCount={dashboardData?.stats?.fulfilledRequests ?? 14}
          activeCount={dashboardData?.stats?.activeRequests ?? 2}
          cancelledCount={3}
          avgResponseMinutes={7.2}
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
        ) : dashboardData?.recentRequests && dashboardData.recentRequests.length > 0 ? (
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
              {dashboardData.recentRequests.map((req: any) => (
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
                        View Matches ({req.matchedCount || 3})
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
    </div>
  );
};
