import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtPayload, AuthenticatedUser } from '../../shared/security/interfaces/jwt.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private authService: AuthService,
    configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    try {
      // For now, basic validation
      if (!payload || !payload.sub) {
        return null;
      }

      // Find user by ID
      const user = await this.authService.findUserById(payload.sub);

      if (!user || !user.isActive) {
        return null;
      }

      return {
        ...user,
        role: payload.role,
      };
    } catch (error) {
      return null;
    }
  }
}