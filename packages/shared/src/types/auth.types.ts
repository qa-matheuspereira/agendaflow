import type { UserRole } from '../enums';

export interface JwtPayload {
  sub: string;
  email: string;
  companyId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  companyId: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}
