'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface SessionUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isPlatformAdmin: boolean;
}

interface AuthState {
  user: SessionUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
const API = API_BASE;

export function getApiBaseUrl(): string {
  return API_BASE;
}

export function getStoredToken(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

const SESSION_KEY = 'fleek_session';

interface StoredSession {
  user: SessionUser;
  accessToken: string;
  refreshToken?: string;
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(s: StoredSession | null) {
  if (!s) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

/** Exchange the stored refresh token for a fresh pair; returns the new access token. */
async function tryRefresh(): Promise<string | null> {
  const session = readSession();
  if (!session?.refreshToken) return null;

  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) {
      writeSession(null);
      return null;
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    writeSession({ ...session, accessToken: data.accessToken, refreshToken: data.refreshToken });
    return data.accessToken;
  } catch {
    return null;
  }
}

const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = options;

  const doFetch = async (authToken: string | null | undefined) =>
    fetch(`${API}${path}`, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...rest.headers,
      },
    });

  let res = await doFetch(token);

  // Access token expired → rotate silently once, then replay the request.
  if (res.status === 401 && token && !AUTH_PATHS.some((p) => path.startsWith(p))) {
    const fresh = await tryRefresh();
    if (fresh) res = await doFetch(fresh);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join('; ')
          : body?.message
          ? String(body.message)
          : `Request failed (${res.status})`;
    throw new Error(msg ?? 'Request failed');
  }
  return body as T;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = readSession();
    if (s?.accessToken) {
      setUser(s.user);
      setToken(s.accessToken);
    }
    setLoading(false);
  }, []);

  const persist = useCallback(
    (data: { accessToken: string; refreshToken?: string; user: SessionUser }) => {
      writeSession({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      setToken(data.accessToken);
      setUser(data.user);
    },
    [],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Login failed');
      persist(await res.json());
    },
    [persist],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Registration failed');
      persist(await res.json());
    },
    [persist],
  );

  const logout = useCallback(() => {
    const session = readSession();
    // Best-effort server-side revocation; local session is always cleared.
    if (session?.refreshToken) {
      void fetch(`${API}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        keepalive: true,
      }).catch(() => undefined);
    }
    writeSession(null);
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
