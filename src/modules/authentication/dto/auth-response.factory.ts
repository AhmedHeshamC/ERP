import { AuthResponseDto } from './auth.dto';
import { UserResponse } from '../../users/dto/user.dto';

/**
 * Factory for creating authentication responses
 * Ensures consistent response format across the application
 */
export class AuthResponseFactory {
  static create(
    user: UserResponse,
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): AuthResponseDto {
    return {
      accessToken,
      refreshToken,
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  }
}