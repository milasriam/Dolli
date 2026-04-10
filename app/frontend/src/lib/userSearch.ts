import { getAPIBaseURL } from '@/lib/config';

export type UserSearchItem = {
  user_id: string;
  display_name: string;
  is_verified_organization: boolean;
  account_type: string;
  subtitle: string | null;
};

export async function searchUsers(q: string, limit = 24): Promise<UserSearchItem[]> {
  const term = q.trim();
  if (!term) return [];
  const params = new URLSearchParams({ q: term, limit: String(limit) });
  const res = await fetch(`${getAPIBaseURL()}/api/v1/users/search?${params}`, { credentials: 'omit' });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: UserSearchItem[] };
  return Array.isArray(data.items) ? data.items : [];
}
