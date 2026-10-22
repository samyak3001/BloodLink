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
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAdminAuditLogsApi();
      setLogs(data.logs || []);
    } catch (err: any) {
      setLogs([]);
      setError(err?.response?.data?.message || err?.message || 'Failed to load system audit logs.');
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

      {error && (
        <div className="p-4 rounded-xl bg-emergency-50 border border-emergency-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-emergency-700">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchLogs}>
            Retry
          </Button>
        </div>
      )}

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
