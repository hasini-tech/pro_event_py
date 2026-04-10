import axios from 'axios';

// Keep browser requests on the frontend origin so the Next.js API route can
// proxy them to the correct backend service. This avoids direct browser calls
// to backend ports like 8001/8002/8003/8004/8005.
const DEFAULT_API_BASE = '/api';

const api = axios.create({
  baseURL: DEFAULT_API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

function getAuthToken() {
  if (typeof window === 'undefined') return null;

  const localToken = localStorage.getItem('evently_token');
  if (localToken) return localToken;

  const cookieToken = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('evently_token='))
    ?.split('=')[1];

  return cookieToken || null;
}

function getStoredUser() {
  if (typeof window === 'undefined') return null;

  const rawUser = localStorage.getItem('evently_user');
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser) as { id?: string; name?: string } | null;
  } catch {
    return null;
  }
}

function isAuthEndpoint(config: any) {
  const url = String(config?.url || '');
  return url.includes('/users/login') || url.includes('/users/signup');
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  const storedUser = getStoredUser();
  const headers = (config.headers || {}) as any;

  const setHeader = (name: string, value: string) => {
    if (typeof headers.set === 'function') {
      headers.set(name, value);
    } else {
      headers[name] = value;
    }
  };

  if (token) {
    setHeader('Authorization', `Bearer ${token}`);
  }

  if (storedUser?.id) {
    setHeader('X-Evently-User-Id', String(storedUser.id));
  }

  if (storedUser?.name) {
    setHeader('X-Evently-User-Name', String(storedUser.name));
  }

  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isAuthFailure =
      err.response?.status === 401 ||
      (err.response?.status === 403 && err.response?.data?.detail === 'Not authenticated');

    if (isAuthFailure && typeof window !== 'undefined' && !isAuthEndpoint(err.config)) {
      localStorage.removeItem('evently_token');
      localStorage.removeItem('evently_user');
      document.cookie = 'evently_token=; Path=/; Max-Age=0; SameSite=Lax';
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
