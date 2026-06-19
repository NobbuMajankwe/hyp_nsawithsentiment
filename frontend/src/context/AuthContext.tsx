import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { attachAuthInterceptor } from "../services/api";

import { TOKEN_KEY, USER_KEY, loadAuthState } from "../utils/authStorage";

import type { AuthState, AuthUser } from "../types/auth";

interface AuthContextValue extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadAuthState);

  const login = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);

    localStorage.setItem(USER_KEY, JSON.stringify(user));

    setState({
      token,
      user,
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);

    localStorage.removeItem(USER_KEY);

    setState({
      token: null,
      user: null,
    });
  }, []);

  useEffect(() => {
    attachAuthInterceptor(logout);
  }, [logout]);

  const value = useMemo(
    () => ({
      ...state,
      login,
      logout,
      isAuthenticated: Boolean(state.token),
    }),
    [state, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return ctx;
}
