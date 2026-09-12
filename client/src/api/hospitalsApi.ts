import { authenticatedFetch } from './authApi';
import { API_BASE_URL } from '../config/api';

export async function getHospitalDashboardApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/hospitals/dashboard`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch hospital dashboard');
  return json;
}

export async function getHospitalRequestsApi(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authenticatedFetch(`${API_BASE_URL}/api/hospitals/requests?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch hospital requests');
  return json;
}
