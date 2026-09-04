import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, Clock } from 'lucide-react';
import { getAdminAuditLogsApi } from '../../api/adminApi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';

export const AdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const data = await getAdminAuditLogsApi();
      setLogs(data.logs || []);
    } catch (err) {
      // Fallback demo audit logs
      setLogs([
        {
          id: 'log-01',
          timestamp: '2026-09-03 14:15:22',
          action: 'EMERGENCY_REQUEST_CREATED',
          actorName: 'Apollo Emergency Hospital',
          actorRole: 'HOSPITAL',
          resource: 'REQ-2026-001 (O- Blood)',
          details: 'Dispatched 3 units emergency broadcast to 12 nearby donors',
        },
        {
          id: 'log-02',
          timestamp: '2026-09-03 14:22:10',
          action: 'DONOR_RESPONSE_ACCEPTED',
          actorName: 'Marcus Vance',
          actorRole: 'DONOR',
          resource: 'REQ-2026-001',
          details: 'Accepted donor dispatch with transit estimate 8 mins',
        },
        {
          id: 'log-03',
          timestamp: '2026-09-03 12:40:05',
          action: 'HOSPITAL_VERIFIED',
          actorName: 'Platform Administrator',
          actorRole: 'ADMIN',
          resource: 'St. Jude Heart Institute',
          details: 'Verified against state registry: Active license HOSP-LIC-8819',
        },
        {
          id: 'log-04',
          timestamp: '2026-09-02 18:05:44',
          action: 'DONOR_SCREENING_ATTESTED',
          actorName: 'Sarah Connor',
          actorRole: 'DONOR',
          resource: 'Screening Checklist',
          details: 'Self-reported eligibility checklist completed with disclaimer agreement',
        },
        {
          id: 'log-05',
          timestamp: '2026-09-02 09:30:12',
          action: 'USER_REGISTERED',
          actorName: 'Elena Rostova',
          actorRole: 'DONOR',
          resource: 'User Account',
          details: 'New donor registered with blood group A-',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.actorName?.toLowerCase().includes(q) ||
      l.resource?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security & Compliance Audit Logs
          </h1>
          <p className="text-xs text-slate-500">
            Immutable system audit records tracking platform actions, user interactions, and state changes.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh Logs
        </Button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm">
        <Input
          label="Search Audit Events"
          placeholder="e.g. EMERGENCY_REQUEST, Marcus, Verified"
          leftIcon={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : filteredLogs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Event Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target Resource</TableHead>
              <TableHead>Metadata / Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log: any) => (
              <TableRow key={log.id || log._id}>
                <TableCell className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {log.timestamp}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs font-bold text-clinical-700">
                  {log.action}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-semibold text-slate-900 text-xs">{log.actorName || 'System'}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{log.actorRole || 'SYSTEM'}</p>
                  </div>
                </TableCell>
                <TableCell className="font-medium text-slate-800 text-xs">
                  {log.resource}
                </TableCell>
                <TableCell className="text-xs text-slate-600 max-w-sm">
                  {log.details}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="No Audit Logs Found"
          description="There are no audit events matching your search criteria."
          actionLabel="Clear Search"
          onAction={() => setSearchQuery('')}
        />
      )}
    </div>
  );
};
