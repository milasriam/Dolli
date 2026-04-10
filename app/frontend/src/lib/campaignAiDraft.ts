import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

export type CampaignAiDraft = {
  title: string;
  description: string;
  category: string;
  goal_amount: number;
  impact_statement: string;
  image_url?: string;
  gif_url?: string;
  video_url?: string;
  normalization_notes?: string[];
};

export async function fetchCampaignAiDraft(
  prompt: string,
  model = 'deepseek-v3.2',
): Promise<CampaignAiDraft> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${getAPIBaseURL()}/api/v1/campaigns/ai-draft`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, model }),
    credentials: 'omit',
  });

  const data = (await res.json().catch(() => ({}))) as { detail?: string };
  if (!res.ok) {
    const detail =
      typeof data.detail === 'string' ? data.detail : 'AI draft failed';
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as CampaignAiDraft;
}
