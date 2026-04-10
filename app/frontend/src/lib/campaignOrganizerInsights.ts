import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';

export type CampaignOrganizerInsights = {
  display_name: string | null;
  /** Absent for verified organizations (personal giving stats are not shown). */
  paid_donations_count: number | null;
  campaigns_created_total: number;
  campaigns_active_count: number;
  is_verified_organization?: boolean;
  organization_badge_label?: string | null;
  /** Platform-recognized supporter badge (admin-curated), public on campaign page. */
  curated_badge_label?: string | null;
  curated_badge_slug?: string | null;
  /** Promotional frame on organizer block (`frame` | `featured`). */
  curated_highlight?: string | null;
  organizer_follower_count?: number;
  viewer_following_organizer?: boolean | null;
  /** Mutual follow with the logged-in viewer. */
  viewer_friends_with_organizer?: boolean | null;
};

export async function fetchCampaignOrganizerInsights(
  campaignId: number,
): Promise<CampaignOrganizerInsights | null> {
  const token = authApi.getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(
    `${getAPIBaseURL()}/api/v1/entities/campaigns/${campaignId}/organizer-insights`,
    { credentials: 'omit', headers },
  );
  if (!res.ok) return null;
  return res.json() as Promise<CampaignOrganizerInsights>;
}
