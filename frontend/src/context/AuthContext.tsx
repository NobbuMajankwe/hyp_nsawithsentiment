/**
 * AuthContext — thin wrapper around the Redux auth slice.
 *
 * Components that already import useAuth() keep working unchanged.
 * Under the hood, login/logout dispatch to the Redux store so the
 * auth state is accessible both via context and via useAppSelector.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';

import { attachAuthInterceptor } from '../services/api';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { login as loginAction, logout as logoutAction } from '../store/authSlice';
import type { AuthUser } from '../types/auth';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);

  const login = useCallback(
    (token: string, user: AuthUser) => dispatch(loginAction({ token, user })),
    [dispatch],
  );

  const logout = useCallback(() => dispatch(logoutAction()), [dispatch]);

  // Attach 401 interceptor once
  useEffect(() => {
    attachAuthInterceptor(logout);
  }, [logout]);

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, logout }),
    [token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
