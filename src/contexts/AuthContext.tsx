import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import api, { ACCESS_TOKEN_KEY } from '../api/axios';
import { fetchTenantProfile } from '../services/tenantProfileApi';
import {
  clearServerCompanyProfile,
  setServerCompanyProfile,
} from '../services/settingsService';
import { syncAuthUser, clearAuthUser } from '../store/authStore';

export type AuthRole = 'admin' | 'manager' | 'accountant' | 'driver' | 'sales';

export interface AuthUser {
  id?: number | string;
  username: string;
  full_name: string;
  role: AuthRole;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  role: AuthRole;
  username: string;
  full_name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: AuthRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_USER_KEY = 'bettano_auth_user';

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: AuthUser) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  syncAuthUser(user);
}

function loadTenantProfile(): void {
  void fetchTenantProfile()
    .then(setServerCompanyProfile)
    .catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ACCESS_TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearServerCompanyProfile();
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    clearAuthUser();
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const restoreSession = useCallback(async () => {
    const storedToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!storedToken) {
      clearServerCompanyProfile();
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    try {
      const { data } = await api.get<AuthUser>('/api/auth/me');
      const restored: AuthUser = {
        id: data.id,
        username: data.username,
        full_name: data.full_name,
        role: data.role,
      };
      setUser(restored);
      syncAuthUser(restored);
      loadTenantProfile();
    } catch {
      clearServerCompanyProfile();
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      clearAuthUser();
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const { data } = await api.post<LoginResponse>('/api/auth/login', {
      username,
      password,
      remember_me: rememberMe,
    });
    const nextUser: AuthUser = {
      username: data.username,
      full_name: data.full_name,
      role: data.role,
    };
    persistSession(data.access_token, nextUser);
    setToken(data.access_token);
    setUser(nextUser);
    loadTenantProfile();
  }, []);

  const hasRole = useCallback(
    (...roles: AuthRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login,
      logout,
      hasRole,
    }),
    [user, token, isLoading, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
