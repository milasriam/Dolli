import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';

export type FriendBrief = { user_id: string; name?: string | null };

export async function fetchMyFriends(): Promise<{ items: FriendBrief[]; total: number } | null> {
  const token = authApi.getStoredToken();
  if (!token) return null;
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/me/friends`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ items: FriendBrief[]; total: number }>;
}
