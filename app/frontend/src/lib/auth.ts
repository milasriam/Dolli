import axios, { AxiosInstance } from 'axios';
import { refreshWebSdkClient } from './api';
import { getAPIBaseURL } from './config';

const AUTH_TOKEN_KEY = 'dolli_auth_token';

export type LoginOptions = {
  google_oidc: boolean;
  tiktok: boolean;
  meta_facebook: boolean;
  password: boolean;
  email_signup: boolean;
  magic_link: boolean;
  password_reset: boolean;
  local_demo_redirect: boolean;
};

export async function fetchLoginOptions(): Promise<LoginOptions | null> {
  try {
    const res = await fetch(`${getAPIBaseURL()}/api/v1/auth/login-options`);
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<LoginOptions>;
    return {
      google_oidc: Boolean(j.google_oidc),
      tiktok: Boolean(j.tiktok),
      meta_facebook: Boolean(j.meta_facebook),
      password: Boolean(j.password),
      email_signup: Boolean(j.email_signup),
      magic_link: Boolean(j.magic_link),
      password_reset: Boolean(j.password_reset),
      local_demo_redirect: Boolean(j.local_demo_redirect),
    };
  } catch {
    return null;
  }
}

/** Full-page redirect to backend OAuth start (avoids SPA /api CORS on redirect). */
export function startOAuthUrl(apiPath: string): void {
  window.location.assign(`${getAPIBaseURL()}${apiPath}`);
}

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  getStoredToken(): string | null {
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  }

  setStoredToken(token: string) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    refreshWebSdkClient();
  }

  clearStoredToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem('token');
    refreshWebSdkClient();
  }

  async getCurrentUser() {
    const token = this.getStoredToken();
    if (!token) return null;

    const url = `${this.getBaseURL()}/api/v1/auth/me`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
      });
    } catch {
      throw new Error('Failed to get user info');
    }

    if (res.status === 401) {
      this.clearStoredToken();
      return null;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail =
        typeof (data as { detail?: unknown }).detail === 'string'
          ? (data as { detail: string }).detail
          : 'Failed to get user info';
      throw new Error(detail);
    }

    return res.json();
  }

  async updateProfile(body: {
    name?: string;
    nsfw_filter_enabled?: boolean;
    instagram_handle?: string | null;
  }) {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated');
    const url = `${this.getBaseURL()}/api/v1/users/profile`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
      const detail =
        typeof data.detail === 'string' ? data.detail : 'Failed to update profile';
      throw new Error(detail);
    }
    return res.json();
  }

  async register(email: string, password: string) {
    const url = `${this.getBaseURL()}/api/v1/auth/register`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'omit',
      });
    } catch {
      const err = new Error('Network Error') as Error & { code?: string };
      err.code = 'ERR_NETWORK';
      throw err;
    }
    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      detail?: string;
    };
    if (!res.ok) {
      const msg = typeof data.detail === 'string' ? data.detail : 'Registration failed';
      const e = new Error(msg) as Error & {
        response?: { status: number; data: unknown };
      };
      e.response = { status: res.status, data: data as Record<string, unknown> };
      throw e;
    }
    const token = data?.token;
    if (!token) throw new Error('Login token is missing');
    this.setStoredToken(token);
    return data;
  }

  async requestMagicLink(email: string) {
    const url = `${this.getBaseURL()}/api/v1/auth/magic-link/request`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'omit',
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not send link');
    }
    return res.json().catch(() => ({}));
  }

  async consumeMagicLink(token: string) {
    const url = `${this.getBaseURL()}/api/v1/auth/magic-link/consume`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      credentials: 'omit',
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; detail?: string };
    if (!res.ok) {
      throw new Error(typeof data.detail === 'string' ? data.detail : 'Invalid or expired link');
    }
    const t = data?.token;
    if (!t) throw new Error('Login token is missing');
    this.setStoredToken(t);
    return data;
  }

  async localLogin(email: string, password: string) {
    const url = `${this.getBaseURL()}/api/v1/auth/local-login`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'omit',
      });
    } catch {
      const err = new Error('Network Error') as Error & { code?: string };
      err.code = 'ERR_NETWORK';
      throw err;
    }

    const data = (await res.json().catch(() => ({}))) as {
      token?: string;
      detail?: string;
    };

    if (!res.ok) {
      const msg =
        typeof data.detail === 'string' ? data.detail : 'Login failed';
      const e = new Error(msg) as Error & {
        response?: { status: number; data: unknown };
      };
      e.response = { status: res.status, data: data as Record<string, unknown> };
      throw e;
    }

    const token = data?.token;
    if (!token) throw new Error('Login token is missing');
    this.setStoredToken(token);
    return data;
  }

  async login() {
    window.location.assign('/login');
  }

  startGoogleOidc() {
    startOAuthUrl('/api/v1/auth/login');
  }

  startTikTok() {
    startOAuthUrl('/api/v1/auth/social/tiktok/login');
  }

  startMetaFacebook() {
    startOAuthUrl('/api/v1/auth/social/meta/login');
  }

  private async _postBearerJson(path: string, body?: Record<string, unknown>) {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated');
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let initBody: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      initBody = JSON.stringify(body);
    }
    const res = await fetch(`${this.getBaseURL()}${path}`, {
      method: 'POST',
      headers,
      body: initBody,
      credentials: 'omit',
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(typeof errBody.detail === 'string' ? errBody.detail : 'Request failed');
    }
    if (res.status === 204 || res.status === 205) {
      return {};
    }
    return (await res.json().catch(() => ({}))) as { detail?: string; url?: string };
  }

  async startSocialLinkTikTok(): Promise<void> {
    const data = await this._postBearerJson('/api/v1/auth/social/link/tiktok/start');
    const url = typeof data.url === 'string' ? data.url : '';
    if (!url) throw new Error('Missing redirect URL');
    window.location.assign(url);
  }

  async startSocialLinkMeta(): Promise<void> {
    const data = await this._postBearerJson('/api/v1/auth/social/link/meta/start');
    const url = typeof data.url === 'string' ? data.url : '';
    if (!url) throw new Error('Missing redirect URL');
    window.location.assign(url);
  }

  async unlinkTikTok(): Promise<void> {
    await this._postBearerJson('/api/v1/auth/social/unlink/tiktok');
  }

  async unlinkMeta(): Promise<void> {
    await this._postBearerJson('/api/v1/auth/social/unlink/meta');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const token = this.getStoredToken();
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${this.getBaseURL()}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
      credentials: 'omit',
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not change password');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const res = await fetch(`${this.getBaseURL()}/api/v1/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
      credentials: 'omit',
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not send reset email');
    }
  }

  async resetPasswordWithToken(token: string, password: string): Promise<void> {
    const res = await fetch(`${this.getBaseURL()}/api/v1/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim(), password }),
      credentials: 'omit',
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; detail?: string };
    if (!res.ok) {
      throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not reset password');
    }
    const t = data?.token;
    if (!t) throw new Error('Login token is missing');
    this.setStoredToken(t);
  }

  async logout() {
    try {
      const response = await this.client.get(`${this.getBaseURL()}/api/v1/auth/logout`);
      this.clearStoredToken();
      window.location.assign(response.data.redirect_url || '/');
    } catch (error: any) {
      this.clearStoredToken();
      window.location.assign('/');
    }
  }
}

export const authApi = new RPApi();
