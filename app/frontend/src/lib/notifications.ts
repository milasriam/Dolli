import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';

export type UserNotification = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  campaign_id: number | null;
  actor_user_id: string | null;
  read_at: string | null;
  created_at: string | null;
};

export type NotificationList = {
  items: UserNotification[];
  total: number;
  skip: number;
  limit: number;
};

export async function fetchUnreadNotificationCount(): Promise<number> {
  const token = authApi.getStoredToken();
  if (!token) return 0;
  const res = await fetch(`${getAPIBaseURL()}/api/v1/auth/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { count?: number };
  return Number.isFinite(Number(data.count)) ? Number(data.count) : 0;
}

export async function fetchNotifications(skip = 0, limit = 50): Promise<NotificationList | null> {
  const token = authApi.getStoredToken();
  if (!token) return null;
  const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
  const res = await fetch(`${getAPIBaseURL()}/api/v1/auth/notifications?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) return null;
  return res.json() as Promise<NotificationList>;
}

export async function markNotificationsRead(ids: number[]): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${getAPIBaseURL()}/api/v1/auth/notifications/mark-read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
    credentials: 'omit',
  });
  if (!res.ok && res.status !== 204) throw new Error('Failed to mark read');
}

export async function markAllNotificationsRead(): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${getAPIBaseURL()}/api/v1/auth/notifications/mark-all-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok && res.status !== 204) throw new Error('Failed to mark all read');
}
