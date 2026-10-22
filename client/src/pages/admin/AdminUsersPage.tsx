import React, { useEffect, useState } from 'react';
import { Search, CheckCircle2, Ban, RefreshCw } from 'lucide-react';
import { getAdminUsersApi, updateUserStatusApi } from '../../api/adminApi';
import { useToast } from '../../components/feedback';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/Table';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const AdminUsersPage: React.FC = () => {
  const { toast } = useToast();

  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [pendingUser, setPendingUser] = useState<{ id: string; name: string; newStatus: 'ACTIVE' | 'SUSPENDED' } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, string> = {};
      if (selectedRole !== 'ALL') params.role = selectedRole;

      const data = await getAdminUsersApi(params);
      setUsers(data.users || []);
    } catch (err: any) {
      setUsers([]);
      setError(err?.response?.data?.message || err?.message || 'Failed to retrieve user accounts from server.');
      toast.error('Unable to fetch users directory from database.', 'Data Load Error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedRole]);

  const handlePromptToggle = (user: any) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setPendingUser({ id: user.id || user._id, name: user.name, newStatus: nextStatus });
    setConfirmOpen(true);
  };

  const executeToggleStatus = async () => {
    if (!pendingUser) return;
    try {
      await updateUserStatusApi(pendingUser.id, pendingUser.newStatus, 'Admin moderation action');
      toast.success(
        `User ${pendingUser.name} has been ${pendingUser.newStatus.toLowerCase()}.`,
        'User Status Updated'
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === pendingUser.id || u._id === pendingUser.id
            ? { ...u, status: pendingUser.newStatus }
            : u
        )
      );
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || `Failed to update status for ${pendingUser.name}.`,
        'Action Failed'
      );
    } finally {
      setConfirmOpen(false);
      setPendingUser(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            User Directory & Access Moderation
          </h1>
          <p className="text-xs text-slate-500">
            Audit registered accounts, role entitlements, and manage suspension privileges.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          Refresh Directory
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-emergency-50 border border-emergency-200 flex items-center justify-between">
          <p className="text-xs font-semibold text-emergency-700">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchUsers}>
            Retry
          </Button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-soft-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Search by Name, Email, or Locality"
          placeholder="e.g. Connor, Apollo, Central"
          leftIcon={<Search className="h-4 w-4" />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <Select
          label="Filter by Role"
          options={[
            { value: 'ALL', label: 'All Roles' },
            { value: 'DONOR', label: 'Blood Donors' },
            { value: 'HOSPITAL', label: 'Hospitals' },
            { value: 'ADMIN', label: 'Administrators' },
          ]}
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={4} columns={6} />
      ) : filteredUsers.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / Organization</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Locality</TableHead>
              <TableHead>Blood Group</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead className="text-right">Moderation Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u: any) => {
              const uId = u.id || u._id;
              const isActive = u.status === 'ACTIVE';

              return (
                <TableRow key={uId}>
                  <TableCell>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{u.name}</p>
                      <p className="text-[11px] text-slate-400">{u.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge role={u.role} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 font-medium">
                    {u.city || 'Central Region'}
                  </TableCell>
                  <TableCell>
                    {u.bloodGroup ? <Badge bloodGroup={u.bloodGroup} /> : <span className="text-slate-400 text-xs">—</span>}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-vitality-50 text-vitality-700 border border-vitality-200'
                          : 'bg-emergency-50 text-emergency-700 border border-emergency-200'
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <Ban className="h-3 w-3" />
                          Suspended
                        </>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.role !== 'ADMIN' ? (
                      <Button
                        size="sm"
                        variant={isActive ? 'ghost' : 'vitality'}
                        onClick={() => handlePromptToggle(u)}
                        className={isActive ? 'text-emergency-600 hover:text-emergency-700' : ''}
                      >
                        {isActive ? 'Suspend Account' : 'Reactivate'}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic font-medium">Protected Admin</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="No Users Found"
          description="No user records matched the selected filters."
          actionLabel="Reset Filters"
          onAction={() => {
            setSelectedRole('ALL');
            setSearchQuery('');
          }}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeToggleStatus}
        title={pendingUser?.newStatus === 'SUSPENDED' ? 'Suspend Account' : 'Reactivate Account'}
        message={`Are you sure you wish to change status for ${pendingUser?.name} to ${pendingUser?.newStatus}?`}
        confirmText={pendingUser?.newStatus === 'SUSPENDED' ? 'Suspend User' : 'Reactivate User'}
        variant={pendingUser?.newStatus === 'SUSPENDED' ? 'danger' : 'info'}
      />
    </div>
  );
};
