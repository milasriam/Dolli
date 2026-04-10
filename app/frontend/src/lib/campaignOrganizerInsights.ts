import { getAPIBaseURL } from '@/lib/config';

export type CampaignOrganizerInsights = {
  display_name: string | null;
  /** Absent for verified organizations (personal giving stats are not shown). */
  paid_donations_count: number | null;
  campaigns_created_total: number;
  campaigns_active_count: number;
  is_verified_organization?: boolean;
  organization_badge_label?: string | null;
};

export async function fetchCampaignOrganizerInsights(
  campaignId: number,
): Promise<CampaignOrganizerInsights | null> {
  const res = await fetch(
    `${getAPIBaseURL()}/api/v1/entities/campaigns/${campaignId}/organizer-insights`,
    { credentials: 'omit' },
  );
  if (!res.ok) return null;
  return res.json() as Promise<CampaignOrganizerInsights>;
}
