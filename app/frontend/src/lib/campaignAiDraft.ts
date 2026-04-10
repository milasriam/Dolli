import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

export type CampaignAiStatus = {
  enabled: boolean;
  hub_configured: boolean;
  default_model?: string;
};

export async function fetchCampaignAiStatus(): Promise<CampaignAiStatus> {
  const res = await fetch(`${getAPIBaseURL()}/api/v1/campaigns/ai-status`, { credentials: 'omit' });
  const data = (await res.json().catch(() => ({}))) as Partial<CampaignAiStatus>;
  return {
    enabled: Boolean(data.enabled),
    hub_configured: Boolean(data.hub_configured),
    default_model: typeof data.default_model === 'string' ? data.default_model : undefined,
  };
}

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
  model = 'gpt-4o-mini',
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

export type AiRefineField = 'title' | 'description' | 'impact_statement';

export async function fetchCampaignAiRefine(
  field: AiRefineField,
  storyContext: string,
  currentValue: string,
  model = 'gpt-4o-mini',
): Promise<{ value: string; normalization_notes?: string[] }> {
  const token = authApi.getStoredToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${getAPIBaseURL()}/api/v1/campaigns/ai-refine`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      field,
      story_context: storyContext,
      current_value: currentValue,
      model,
    }),
    credentials: 'omit',
  });

  const data = (await res.json().catch(() => ({}))) as { detail?: string; value?: string; normalization_notes?: string[] };
  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : 'AI refine failed';
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return { value: data.value || '', normalization_notes: data.normalization_notes };
}
