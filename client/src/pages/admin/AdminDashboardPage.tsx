import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Activity,
  ArrowRight,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { getAdminAnalyticsApi } from '../../api/adminApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
  EmergencyTrendsChart,
  DonorActivityChart,
  FulfillmentRateChart,
} from '../../components/domain/DashboardCharts';

export const AdminDashboardPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAdminAnalyticsApi();
      setAnalytics(data);
    } catch (err: unknown) {
      setAnalytics(null);
      setError(err instanceof Error ? err.message : 'Failed to retrieve administrative analytics.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const stats = analytics?.analytics || analytics;
  const totalDonors = stats?.totalDonors ?? stats?.users?.totalDonors ?? 0;
  const activeDonors = stats?.activeDonors ?? stats?.users?.availableDonors ?? 0;
  const totalHospitals = stats?.totalHospitals ?? stats?.users?.totalHospitals ?? 0;
  const pendingHospitals = stats?.pendingHospitals ?? stats?.users?.pendingHospitals ?? 0;
  const totalRequests = stats?.totalRequests ?? stats?.requests?.totalRequests ?? 0;
  const activeRequests = stats?.activeRequests ?? stats?.requests?.activeRequests ?? 0;
  const fulfilledRequests = stats?.fulfilledRequests ?? stats?.requests?.fulfilledRequests ?? 0;
  const cancelledRequests = stats?.cancelledRequests ?? stats?.requests?.cancelledRequests ?? 0;
  const fulfillmentRate = stats?.fulfillmentRate ?? '0%';
  const trends = stats?.trends || [];
  const donorActivity = stats?.donorActivity || [];

  return (
    <div className="space-y-8">
      {/* Error Alert if API Fails */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-red-800">Analytics Service Unavailable</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
          <Button size="sm" variant="outline" onClick={fetchAnalytics}>
            Retry
          </Button>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-soft">
        {isLoading && (
          <div className="sr-only" aria-live="polite">Loading analytics...</div>
        )}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Platform Administration & Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
              Admin Access
            </span>
          </div>
          <p className="text-xs text-slate-500">
            System-wide operational oversight, user moderation, hospital validation, and compliance auditing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/admin/hospitals">
            <Button size="sm" variant="clinical" leftIcon={<Building2 className="h-4 w-4" />}>
              Verify Hospitals ({pendingHospitals})
            </Button>
          </Link>
          <Link to="/admin/users">
            <Button size="sm" variant="outline" leftIcon={<Users className="h-4 w-4" />}>
              Users Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Donors</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">{totalDonors}</span>
                <span className="text-[11px] text-vitality-600 font-bold">
                  {activeDonors} Active
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-vitality-50 text-vitality-600">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hospital Facilities</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-slate-900">{totalHospitals}</span>
                <span className="text-[11px] text-amber-600 font-bold">
                  {pendingHospitals} Pending
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-clinical-50 text-clinical-600">
              <Building2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Emergency Requests</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-emergency-600">
                  {totalRequests}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {activeRequests} Live
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
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fulfillment Rate</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-vitality-700">
                  {fulfillmentRate}
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {fulfilledRequests} completed
                </span>
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interactive Platform Analytics & Visualization Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EmergencyTrendsChart data={trends} />
        <FulfillmentRateChart
          fulfilledCount={fulfilledRequests}
          activeCount={activeRequests}
          cancelledCount={cancelledRequests}
          avgResponseMinutes={0}
        />
      </div>

      <div className="w-full">
        <DonorActivityChart data={donorActivity} />
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hoverable>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-clinical-50 text-clinical-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">User Directory</CardTitle>
                <CardDescription>Manage donor, hospital, and admin accounts</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Search users, view verified credentials, inspect contact details, and suspend or activate accounts.
            </p>
            <Link to="/admin/users">
              <Button size="sm" variant="outline" fullWidth rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Open User Management
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card hoverable>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-vitality-50 text-vitality-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Hospital Verification</CardTitle>
                <CardDescription>Review license and facility credentials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Authenticate medical facility licensing and grant emergency dispatch privileges with administrative notes.
            </p>
            <Link to="/admin/hospitals">
              <Button size="sm" variant="outline" fullWidth rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                Review Pending ({pendingHospitals})
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card hoverable>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Compliance Audit Logs</CardTitle>
                <CardDescription>Immutable record of platform events</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Review timestamps, actor IDs, actions, and metadata for full regulatory transparency and audit readiness.
            </p>
            <Link to="/admin/audit-logs">
              <Button size="sm" variant="outline" fullWidth rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                View Audit Logs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
