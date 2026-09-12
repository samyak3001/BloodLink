import { authenticatedFetch } from './authApi';
import { API_BASE_URL } from '../config/api';

export async function getAdminAnalyticsApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/analytics`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch admin analytics');
  return json;
}

export async function getAdminUsersApi(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/users?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch users');
  return json;
}

export async function updateUserStatusApi(id: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to update user status');
  return json;
}

export async function verifyHospitalApi(id: string, isVerified: boolean, adminNotes?: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/hospitals/${id}/verify`, {
    method: 'PATCH',
    body: JSON.stringify({ isVerified, adminNotes }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to verify hospital');
  return json;
}

export async function getAdminAuditLogsApi(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authenticatedFetch(`${API_BASE_URL}/api/admin/audit-logs?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch audit logs');
  return json;
}
