export interface AuthenticatedUser {
  sub: string; // JWT subject claim (user ID)
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserProfileResponse;
  expiresIn: number;
}

export interface LogoutResponseDto {
  message: string;
  correlationId?: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  expiresIn: number;
}

export interface RegisterRequestDto {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}