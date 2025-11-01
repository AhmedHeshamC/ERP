import { UserRole } from '../../../modules/users/dto/user.dto';

/**
 * JWT Payload interface for token validation
 * Follows OWASP A02: Secure token structure
 */
export interface JwtPayload {
  sub: string; // User ID (subject)
  email: string;
  username: string;
  role: UserRole;
  iat: number; // Issued at
  exp: number; // Expires at
  iss?: string; // Issuer
  aud?: string; // Audience
}

/**
 * Authenticated User interface
 * Represents user object attached to request after JWT validation
 */
export interface AuthenticatedUser extends Omit<JwtPayload, 'iat' | 'exp' | 'iss' | 'aud'> {
  id: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/**
 * User Profile Response interface
 * Subset of user data returned in profile endpoint
 */
export interface UserProfileResponse {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

/**
 * Request with authenticated user
 * Extends Express Request interface
 */
export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

/**
 * Token data interface
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Password reset token interface
 */
export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

/**
 * User activity tracking interface
 */
export interface UserActivity {
  userId: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Security event logging interface
 */
export interface SecurityEvent {
  userId?: string;
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'ACCOUNT_LOCKED' | 'SECURITY_VIOLATION';
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}