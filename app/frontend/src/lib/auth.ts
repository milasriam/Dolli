import axios, { AxiosInstance } from 'axios';
import { refreshWebSdkClient } from './api';
import { getAPIBaseURL } from './config';

const AUTH_TOKEN_KEY = 'dolli_auth_token';

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

  async updateProfile(body: { name?: string; nsfw_filter_enabled?: boolean }) {
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
