'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  bio?: string;
  profile_image?: string;
  links?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (data: { name: string; email: string; password: string }) => Promise<{ success: boolean; message?: string }>;
  requestLoginOtp: (email: string) => Promise<{ success: boolean; message?: string; resendInSeconds?: number; debugCode?: string }>;
  verifyLoginOtp: (email: string, code: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseRetryAfterSeconds(err: any) {
  const rawHeader = err?.response?.headers?.['retry-after'];
  const headerValue = Number(rawHeader);
  if (Number.isFinite(headerValue) && headerValue > 0) {
    return Math.ceil(headerValue);
  }

  const message = String(err?.response?.data?.detail || '');
  const matched = message.match(/(\d+)\s*seconds?/i);
  if (matched) {
    return Number(matched[1]);
  }

  return undefined;
}

function persistAuth(user: User, token: string) {
  localStorage.setItem('evently_token', token);
  localStorage.setItem('evently_user', JSON.stringify(user));
  document.cookie = `evently_token=${token}; Path=/; Max-Age=86400; SameSite=Lax`;
}

function clearAuth() {
  localStorage.removeItem('evently_token');
  localStorage.removeItem('evently_user');
  document.cookie = 'evently_token=; Path=/; Max-Age=0; SameSite=Lax';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = (nextUser: User | null) => {
    setUserState(nextUser);

    if (typeof window === 'undefined') {
      return;
    }

    if (nextUser) {
      localStorage.setItem('evently_user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('evently_user');
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('evently_user');
    const token = localStorage.getItem('evently_token');
    if (stored && token) {
      try {
        const parsedUser = JSON.parse(stored);
        // Keep the middleware cookie in sync with the persisted session.
        persistAuth(parsedUser, token);
        setUser(parsedUser);
      } catch {
        clearAuth();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data } = await api.post('/users/login', { email: normalizedEmail, password });
      persistAuth(data.data, data.token);
      setUser(data.data);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.detail || 'Login failed' };
    }
  };

  const signup = async (userData: { name: string; email: string; password: string }) => {
    try {
      const { data } = await api.post('/users/signup', {
        ...userData,
        name: userData.name.trim(),
        email: userData.email.trim().toLowerCase(),
      });
      persistAuth(data.data, data.token);
      setUser(data.data);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.detail || 'Signup failed' };
    }
  };

  const requestLoginOtp = async (email: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data } = await api.post('/users/otp/request', { email: normalizedEmail });
      return {
        success: true,
        message: data.message || undefined,
        resendInSeconds: data.resend_in_seconds,
        debugCode: data.debug_code || undefined,
      };
    } catch (err: any) {
      const retryAfterSeconds = parseRetryAfterSeconds(err);
      return {
        success: false,
        message: err.response?.data?.detail || 'Could not send verification code',
        resendInSeconds: retryAfterSeconds,
      };
    }
  };

  const verifyLoginOtp = async (email: string, code: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedCode = code.trim();
      const { data } = await api.post('/users/otp/verify', {
        email: normalizedEmail,
        code: normalizedCode,
      });
      persistAuth(data.data, data.token);
      setUser(data.data);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err.response?.data?.detail || 'Verification failed',
      };
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        requestLoginOtp,
        verifyLoginOtp,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
