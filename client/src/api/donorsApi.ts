import { authenticatedFetch } from './authApi';

export async function getDonorDashboardApi() {
  const res = await authenticatedFetch('/api/donors/dashboard');
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch donor dashboard');
  return json;
}

export async function toggleDonorAvailabilityApi(isAvailable: boolean) {
  const res = await authenticatedFetch('/api/donors/availability', {
    method: 'PATCH',
    body: JSON.stringify({ isAvailable }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to update availability');
  return json;
}

export async function updateDonorScreeningApi(screening: {
  isAgeEligible: boolean;
  isWeightEligible: boolean;
  hasNoRecentIllness: boolean;
  hasValidInterval: boolean;
  screeningDisclaimerAcknowledged: boolean;
}) {
  const res = await authenticatedFetch('/api/donors/screening', {
    method: 'PATCH',
    body: JSON.stringify(screening),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to update screening checklist');
  return json;
}

export async function respondToRequestApi(requestId: string, action: 'ACCEPTED' | 'DECLINED') {
  const res = await authenticatedFetch(`/api/donors/requests/${requestId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to respond to emergency request');
  return json;
}

export async function getDonorHistoryApi() {
  const res = await authenticatedFetch('/api/donors/history');
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch donation history');
  return json;
}
