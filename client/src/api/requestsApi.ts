import { authenticatedFetch } from './authApi';
import { API_BASE_URL } from '../config/api';
import { BloodGroup, BloodComponent, RequestUrgency, RequestStatus } from '../types';

export interface CreateRequestData {
  patientIdentifier: string;
  bloodGroup: BloodGroup;
  bloodComponent?: BloodComponent;
  unitsRequired: number;
  urgency: RequestUrgency;
  requiredWithinHours: number;
  coordinates?: [number, number];
  maxRadiusKm?: number;
  notes?: string;
}

export async function getEmergencyRequestsApi(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authenticatedFetch(`${API_BASE_URL}/api/requests?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch emergency requests');
  return json;
}

export async function getEmergencyRequestByIdApi(id: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch emergency request');
  return json;
}

export async function createEmergencyRequestApi(data: CreateRequestData) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/requests`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to create emergency request');
  return json;
}

export async function updateRequestStatusApi(
  id: string,
  status: RequestStatus,
  reason?: string,
  fulfilledDonorId?: string
) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason, fulfilledDonorId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to update request status');
  return json;
}

export async function getPotentialMatchesApi(id: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/${id}/potential-matches`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch potential matches');
  return json;
}

export async function contactAcceptedDonorApi(requestId: string, donorId: string, message?: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/requests/${requestId}/contact-donor`, {
    method: 'POST',
    body: JSON.stringify({ donorId, message }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to contact donor');
  return json;
}
