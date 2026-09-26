import { UserProfile } from '../types';
import { api, setAuthToken, removeAuthToken, getAuthToken, API_BASE_URL } from './api';

interface BackendUserResponse {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

function mapBackendUser(user: BackendUserResponse): UserProfile {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: 'Support Specialist',
    is_active: user.is_active,
  };
}

export const authService = {
  async login(username: string, password: string): Promise<UserProfile> {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Login failed');
    }

    const data: LoginResponse = await response.json();
    setAuthToken(data.access_token);

    const meResponse = await api.get<BackendUserResponse>('/auth/me');
    if (meResponse.data) {
      return mapBackendUser(meResponse.data);
    }
    throw new Error('Failed to fetch user profile');
  },

  async register(username: string, email: string, password: string): Promise<UserProfile> {
    const response = await api.post<BackendUserResponse>('/auth/register', { username, email, password });
    if (response.error) throw new Error(response.error);

    const loginResponse = await this.login(username, password);
    return loginResponse;
  },

  async getCurrentUser(): Promise<UserProfile | null> {
    const token = getAuthToken();
    if (!token) return null;

    const response = await api.get<BackendUserResponse>('/auth/me');
    if (response.data) {
      return mapBackendUser(response.data);
    }
    return null;
  },

  async logout(): Promise<void> {
    removeAuthToken();
  },
};