import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, LoginCredentials, RegisterData } from '../types';
import {
  getStoredToken,
  setStoredToken,
  removeStoredToken,
  loginApi,
  registerApi,
  getMeApi,
} from '../api/authApi';

interface AuthContextType {
  user: AuthUser | null;
  profile: Record<string, unknown> | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser | undefined>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const currentToken = getStoredToken();
    if (!currentToken) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await getMeApi();
      if (res.user) {
        setUser(res.user);
        setProfile(res.profile || null);
      } else {
        removeStoredToken();
        setUser(null);
        setProfile(null);
      }
    } catch {
      removeStoredToken();
      setUser(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (credentials: LoginCredentials): Promise<AuthUser | undefined> => {
    setIsLoading(true);
    try {
      const res = await loginApi(credentials);
      if (res.token && res.user) {
        setStoredToken(res.token);
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile || null);
        return res.user;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData) => {
    setIsLoading(true);
    try {
      const res = await registerApi(data);
      if (res.token && res.user) {
        setStoredToken(res.token);
        setToken(res.token);
        setUser(res.user);
        setProfile(res.profile || null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
