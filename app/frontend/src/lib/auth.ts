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
    if (!token) {
      return null;
    }

    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        this.clearStoredToken();
        return null;
      }
      throw new Error(
        error.response?.data?.detail || 'Failed to get user info'
      );
    }
  }

  async login() {
    try {
      window.location.assign(`${this.getBaseURL()}/api/v1/auth/login`);
    } catch (error) {
      throw new Error(
        error.response?.data?.detail || 'Failed to initiate login'
      );
    }
  }

  async logout() {
    try {
      const response = await this.client.get(
        `${this.getBaseURL()}/api/v1/auth/logout`
      );
      this.clearStoredToken();
      window.location.assign(response.data.redirect_url);
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to logout');
    }
  }
}

export const authApi = new RPApi();
