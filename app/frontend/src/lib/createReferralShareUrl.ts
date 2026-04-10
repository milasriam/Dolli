import { client } from '@/lib/api';

/** Logged-in only: creates a tracked referral and returns full page URL. */
export async function createReferralShareUrl(
  campaignId: number,
  platform: string,
): Promise<string> {
  const response = await client.apiCall.invoke({
    url: '/api/v1/analytics/create-referral',
    method: 'POST',
    data: { campaign_id: campaignId, platform },
  });
  const sharePath = response.data?.share_url as string;
  if (!sharePath) throw new Error('No share URL returned');
  return `${window.location.origin}${sharePath}`;
}
