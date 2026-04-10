import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';

export type FollowStats = {
  follower_count: number;
  following_count: number;
  mutual_friend_count: number;
};

/** Public: follower / following / mutual friend counts for any user id. */
export async function fetchFollowStats(userId: string): Promise<FollowStats | null> {
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/${encodeURIComponent(userId)}/follow-stats`, {
    credentials: 'omit',
  });
  if (!res.ok) return null;
  return res.json() as Promise<FollowStats>;
}

export type FollowingBrief = { user_id: string; name?: string | null };

export async function fetchMyFollowing(): Promise<{ items: FollowingBrief[]; total: number } | null> {
  const token = authApi.getStoredToken();
  if (!token) return null;
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/me/following`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ items: FollowingBrief[]; total: number }>;
}

export async function fetchFriendStatus(userId: string): Promise<{ friends: boolean } | null> {
  const token = authApi.getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/${encodeURIComponent(userId)}/friend-status`, {
    headers,
    credentials: 'omit',
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ friends: boolean }>;
}

export async function fetchFollowStatus(userId: string): Promise<{ following: boolean } | null> {
  const token = authApi.getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/${encodeURIComponent(userId)}/follow-status`, {
    headers,
    credentials: 'omit',
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ following: boolean }>;
}

export async function setFollowing(userId: string, follow: boolean): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');
  const method = follow ? 'POST' : 'DELETE';
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/${encodeURIComponent(userId)}/follow`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok && res.status !== 204) {
    const data = await res.json().catch(() => ({}));
    const detail = typeof (data as { detail?: unknown }).detail === 'string' ? (data as { detail: string }).detail : 'Request failed';
    throw new Error(detail);
  }
}
