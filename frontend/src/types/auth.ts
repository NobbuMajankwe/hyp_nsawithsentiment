export type UserRole =
  | 'EVENT_ORGANISER'
  | 'SYSTEM_ADMIN';

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}