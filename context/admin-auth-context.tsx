import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { API_BASE_URL, authFetch, parseApiResponse } from '@/lib/api';
import {
  clearAdminSession,
  persistAdminSession,
  readAdminSession,
  setAdminToken,
} from '@/lib/admin-session';

export type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  role?: string;
  scope?: string;
  office?: string;
  shift?: string;
};

type LoginPayload = {
  email: string;
  password: string;
};

type AdminAuthContextValue = {
  admin: AdminProfile | null;
  token: string | null;
  initializing: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  refreshSession: () => Promise<void>;
  logout: () => void;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  const persistAuth = async (nextToken: string, nextAdmin: AdminProfile) => {
    setToken(nextToken);
    setAdmin(nextAdmin);
    await persistAdminSession(nextToken, nextAdmin);
  };

  const refreshSession = async () => {
    const response = await authFetch(`${API_BASE_URL}/admin/session`);
    const data = await parseApiResponse<{ admin: AdminProfile }>(response);
    setAdmin(data.admin);
  };

  useEffect(() => {
    const hydrateSession = async () => {
      const storedSession = await readAdminSession();
      if (!storedSession?.token) {
        setInitializing(false);
        return;
      }

      setAdminToken(storedSession.token);

      try {
        const response = await authFetch(`${API_BASE_URL}/admin/session`);
        const data = await parseApiResponse<{ admin: AdminProfile }>(response);
        await persistAuth(storedSession.token, data.admin);
      } catch {
        await clearAdminSession();
        setToken(null);
        setAdmin(null);
      } finally {
        setInitializing(false);
      }
    };

    void hydrateSession();
  }, []);

  const login = async ({ email, password }: LoginPayload) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseApiResponse<{ token: string; admin: AdminProfile }>(response);
      await persistAuth(data.token, data.admin);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    void clearAdminSession();
    setToken(null);
    setAdmin(null);
  };

  const value = useMemo(
    () => ({
      admin,
      token,
      initializing,
      loading,
      login,
      refreshSession,
      logout,
    }),
    [admin, token, initializing, loading]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }

  return context;
}
