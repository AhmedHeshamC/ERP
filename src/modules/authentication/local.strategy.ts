import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

/**
 * Local authentication strategy for login
 * Implements username/password authentication
 * Follows OWASP A02: Secure password handling
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // Using email as username field
    });
  }

  async validate(username: string, password: string): Promise<any> {
    try {
      // Input validation
      if (!username || !password) {
        throw new BadRequestException('Username and password are required');
      }

      // Find user by username or email
      const user = await this.authService.findUserByUsername(username.toLowerCase());

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Verify password
      const isPasswordValid = await this.authService.validatePassword(user, password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login
      await this.authService.updateLastLogin(user.id);

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
      };

    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }

      throw new BadRequestException('Authentication failed');
    }
  }
}