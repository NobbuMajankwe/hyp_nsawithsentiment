import type { AuthState, AuthUser } from '../types/auth';

export const TOKEN_KEY = 'eventsense_token';
export const USER_KEY = 'eventsense_user';

export function isValidUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;

  const user = value as Partial<AuthUser>;

  return (
    typeof user.id === 'number' &&
    typeof user.fullName === 'string' &&
    typeof user.email === 'string' &&
    (
      user.role === 'EVENT_ORGANISER' ||
      user.role === 'SYSTEM_ADMIN'
    )
  );
}

export function loadAuthState(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw = localStorage.getItem(USER_KEY);

    if (!token || !raw) {
      return {
        token: null,
        user: null,
      };
    }

    const parsed = JSON.parse(raw);

    if (!isValidUser(parsed)) {
      return {
        token: null,
        user: null,
      };
    }

    return {
      token,
      user: parsed,
    };
  } catch {
    return {
      token: null,
      user: null,
    };
  }
}