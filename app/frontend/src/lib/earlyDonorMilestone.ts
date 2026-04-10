import { authApi } from '@/lib/auth';
import { getAPIBaseURL } from '@/lib/config';

export type EarlyDonorMilestone = {
  rank: number | null;
  milestone: 100 | 1000 | 10000 | null;
  total_distinct_donors: number;
};

export async function fetchEarlyDonorMilestone(): Promise<EarlyDonorMilestone | null> {
  const token = authApi.getStoredToken();
  if (!token) return null;
  const res = await fetch(`${getAPIBaseURL()}/api/v1/auth/early-donor-milestone`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<EarlyDonorMilestone>;
}
