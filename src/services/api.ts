/**
 * Base API Configuration
 * Connects to FastAPI backend with proper auth handling.
 */

export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:8000';
  export const AI_AGENT_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_AGENT_URL) ||
  'http://127.0.0.1:8001';

export interface ApiResponse<T> {
  data: T | null;
  error?: string;
  status: number;
}

const TOKEN_KEY = 'cs_auth_token';

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
};

export const removeAuthToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: data?.detail || `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };
    }

    return { data, status: response.status };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
    };
  }
}

export const api = {
  get: <T>(endpoint: string) => fetchWithAuth<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) =>
    fetchWithAuth<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    fetchWithAuth<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => fetchWithAuth<T>(endpoint, { method: 'DELETE' }),
};