import { authenticatedFetch } from './authApi';
import { API_BASE_URL } from '../config/api';

export async function exportUserDataApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/users/export-data`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to export user data');
  return json.data;
}

export async function updatePrivacySettingsApi(settings: {
  hideExactLocation?: boolean;
  showContactToMatchedHospitalsOnly?: boolean;
}) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/users/privacy`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to update privacy settings');
  return json;
}

export async function changePasswordApi(passwords: {
  currentPassword: string;
  newPassword: string;
}) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/users/password`, {
    method: 'PUT',
    body: JSON.stringify(passwords),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to change password');
  return json;
}

export async function deleteAccountApi(password: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/users/account`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to delete account');
  return json;
}
