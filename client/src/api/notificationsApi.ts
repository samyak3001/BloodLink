import { authenticatedFetch } from './authApi';
import { API_BASE_URL } from '../config/api';

export async function getNotificationsApi(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications?${query}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to fetch notifications');
  return json;
}

export async function markNotificationReadApi(id: string) {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to mark notification as read');
  return json;
}

export async function markAllNotificationsReadApi() {
  const res = await authenticatedFetch(`${API_BASE_URL}/api/notifications/read-all`, {
    method: 'PATCH',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || 'Failed to mark all notifications as read');
  return json;
}
