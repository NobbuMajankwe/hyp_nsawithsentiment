import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { attachAuthInterceptor } from '../services/api';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'event_organiser' | 'system_admin';
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'signalcheck_token';
const USER_KEY = 'signalcheck_user';

function loadState(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {
    // ignore parse errors
  }
  return { token: null, user: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadState);

  const login = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ token, user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null });
  }, []);

  // Attach the 401 interceptor once, wired to this logout function
  useEffect(() => {
    attachAuthInterceptor(logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
