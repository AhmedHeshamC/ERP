import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<any> {
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