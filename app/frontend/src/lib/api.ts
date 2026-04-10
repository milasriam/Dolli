import { createClient } from '@metagptx/web-sdk';
import { getAPIBaseURL } from './config';

const DOLLI_AUTH_TOKEN_KEY = 'dolli_auth_token';

/**
 * @metagptx/web-sdk reads `localStorage.token` only when the axios instance is created
 * and merges it into default headers (not per-request). Dolli stores JWT under `dolli_auth_token`.
 */
function syncWebSdkTokenFromDolli(): void {
  if (typeof window === 'undefined') return;
  const t = window.localStorage.getItem(DOLLI_AUTH_TOKEN_KEY);
  if (t) window.localStorage.setItem('token', t);
  else window.localStorage.removeItem('token');
}

function createWebSdkClient() {
  syncWebSdkTokenFromDolli();
  const base = getAPIBaseURL();
  const normalized = base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base;
  return createClient({ baseURL: normalized });
}

export let client = createWebSdkClient();

/** Call after login/logout so Bearer matches Dolli JWT. */
export function refreshWebSdkClient(): void {
  client = createWebSdkClient();
}
