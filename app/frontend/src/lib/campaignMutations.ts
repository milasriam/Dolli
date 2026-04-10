import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

/** UI hint: server still enforces paid donations via DB. */
export function campaignCanUndoPublicState(c: {
  raised_amount?: number | null;
  donor_count?: number | null;
  status?: string | null;
}): boolean {
  const raised = Number(c.raised_amount ?? 0);
  const donors = Number(c.donor_count ?? 0);
  if (raised > 0 || donors > 0) return false;
  const s = (c.status || '').toLowerCase();
  return s === 'active' || s === 'draft';
}

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
  if (typeof data.detail === 'string') return data.detail;
  return `Request failed (${res.status})`;
}

export async function deleteCampaign(id: number): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function revertCampaignToDraft(id: number): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'draft' }),
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type CampaignContentUpdate = {
  title?: string;
  description?: string;
  category?: string;
  goal_amount?: number;
  image_url?: string;
  gif_url?: string;
  video_url?: string;
  impact_statement?: string;
  status?: string;
  urgency_level?: string;
  is_nsfw?: boolean;
};

export async function updateCampaign(id: number, payload: CampaignContentUpdate): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const body = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  ) as Record<string, unknown>;
  if (Object.keys(body).length === 0) return;

  const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function publishCampaignFromDraft(id: number): Promise<void> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${getAPIBaseURL()}/api/v1/entities/campaigns/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'active' }),
    credentials: 'omit',
  });
  if (!res.ok) throw new Error(await parseError(res));
}
