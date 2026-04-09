import axios, { AxiosInstance } from 'axios';
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
  }

  clearStoredToken() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  async getCurrentUser() {
    const token = this.getStoredToken();
    if (!token) return null;

    try {
      const response = await this.client.get(`${this.getBaseURL()}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.clearStoredToken();
        return null;
      }
      throw new Error(error.response?.data?.detail || 'Failed to get user info');
    }
  }

  async localLogin(email: string, password: string) {
    const response = await this.client.post(`${this.getBaseURL()}/api/v1/auth/local-login`, {
      email,
      password,
    });
    const token = response.data?.token;
    if (!token) throw new Error('Login token is missing');
    this.setStoredToken(token);
    return response.data;
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
