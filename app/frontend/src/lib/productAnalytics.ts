import { getAPIBaseURL } from '@/lib/config';
import { authApi } from '@/lib/auth';

/** Server-logged product events (optional auth for richer logs). */
export function trackClientEvent(event: string, payload: Record<string, unknown> = {}): void {
  const token = authApi.getStoredToken();
  void fetch(`${getAPIBaseURL()}/api/v1/analytics/client-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ event, payload }),
    credentials: 'omit',
  }).catch(() => {});
}
