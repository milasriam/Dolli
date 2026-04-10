import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

export type CampaignCreateEligibility = {
  can_create: boolean;
  paid_donations_count: number;
  admin_bypass: boolean;
  dev_bypass: boolean;
  message: string | null;
};

export async function fetchCampaignCreateEligibility(): Promise<CampaignCreateEligibility | null> {
  const token = authApi.getStoredToken();
  if (!token) return null;

  const res = await fetch(
    `${getAPIBaseURL()}/api/v1/entities/campaigns/create-eligibility`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) return null;
  return res.json();
}
