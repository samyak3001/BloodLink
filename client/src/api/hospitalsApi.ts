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

export interface UpdateHospitalProfilePayload {
  hospitalName?: string;
  name?: string;
  email?: string;
  phone?: string;
  emergencyHelpline?: string;
  licenseNumber?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  coordinates?: [number, number];
}

export async function getHospitalProfileApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/hospitals/profile`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch hospital profile');
  return json;
}

export async function updateHospitalProfileApi(payload: UpdateHospitalProfilePayload) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/hospitals/profile`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    const errorMsg = json.errors?.[0]?.message || json.message || 'Failed to update hospital profile';
    throw new Error(errorMsg);
  }
  return json;
}

export async function getRegisteredDonorsApi(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authenticatedFetch(`${API_BASE_URL}/api/hospitals/donors?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch registered donors');
  return json;
}
