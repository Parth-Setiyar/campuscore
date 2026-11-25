import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, registerSessionExpiredHandler, setAuthToken } from '../services/api';
import type { AuthUser } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  sessionExpiredNotice: string | null;
  clearSessionNotice: () => void;
  loginHod: (identifier: string, password: string) => Promise<AuthUser>;
  loginProfessor: (identifier: string, password: string) => Promise<AuthUser>;
  loginStudent: (enrollmentNumber: string, password: string) => Promise<AuthUser>;
  registerStudentViaInvite: (payload: {
    token: string;
    enrollmentNumber: string;
    fullName: string;
    email: string;
    phone?: string;
    password: string;
  }) => Promise<{ user: AuthUser; className: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setUser(null);
      setSessionExpiredNotice('Your session expired or was signed out. Please sign in again.');
    });
  }, []);

  const clearSessionNotice = useCallback(() => {
    setSessionExpiredNotice(null);
  }, []);

  const loginHod = useCallback(async (identifier: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login/hod', {
      method: 'POST',
      body: { identifier, password },
      skipAuth: true,
    });
    setAuthToken(res.token);
    setUser(res.user);
    setSessionExpiredNotice(null);
    return res.user;
  }, []);

  const loginProfessor = useCallback(async (identifier: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login/professor', {
      method: 'POST',
      body: { identifier, password },
      skipAuth: true,
    });
    setAuthToken(res.token);
    setUser(res.user);
    setSessionExpiredNotice(null);
    return res.user;
  }, []);

  const loginStudent = useCallback(async (enrollmentNumber: string, password: string) => {
    const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login/student', {
      method: 'POST',
      body: { enrollmentNumber, password },
      skipAuth: true,
    });
    setAuthToken(res.token);
    setUser(res.user);
    setSessionExpiredNotice(null);
    return res.user;
  }, []);

  const registerStudentViaInvite = useCallback(
    async (payload: {
      token: string;
      enrollmentNumber: string;
      fullName: string;
      email: string;
      phone?: string;
      password: string;
    }) => {
      const res = await apiRequest<{
        token: string;
        user: AuthUser;
        enrollmentRequest: { id: string; status: string; className: string };
      }>('/api/auth/student/register-invite', {
        method: 'POST',
        body: payload,
        skipAuth: true,
      });
      setAuthToken(res.token);
      setUser(res.user);
      setSessionExpiredNotice(null);
      return { user: res.user, className: res.enrollmentRequest.className };
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors during logout
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await apiRequest<{ user: AuthUser }>('/api/auth/me');
    setUser(res.user);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        sessionExpiredNotice,
        clearSessionNotice,
        loginHod,
        loginProfessor,
        loginStudent,
        registerStudentViaInvite,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
