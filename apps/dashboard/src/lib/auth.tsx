'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export interface SessionUser {
  id: string;
  email: string;
  firstName?: string;
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

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('fleek_session');
      if (raw) {
        const s = JSON.parse(raw) as { user: SessionUser; accessToken: string };
        setUser(s.user);
        setToken(s.accessToken);
      }
    } catch {
      // corrupted session — ignore
    }
    setLoading(false);
  }, []);

  const persist = useCallback((accessToken: string, u: SessionUser, refresh?: string) => {
    localStorage.setItem('fleek_session', JSON.stringify({ user: u, accessToken, refreshToken: refresh }));
    setToken(accessToken);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Login failed');
      const data = await res.json();
      persist(data.accessToken, data.user as SessionUser, data.refreshToken);
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
      const data = await res.json();
      persist(data.accessToken, data.user as SessionUser, data.refreshToken);
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('fleek_session');
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

/** Authenticated fetch helper. */
export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, ...rest } = options;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      typeof body?.message === 'string'
        ? body.message
        : Array.isArray(body?.message)
          ? body.message.join('; ')
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export { API };
