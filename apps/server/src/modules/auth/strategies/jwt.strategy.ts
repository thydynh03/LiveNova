import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { loadEnv } from '../../../common/config/env';

export interface AccessTokenPayload {
  sub: string;
  /** C-06 — distinguishes an access token from a refresh credential. */
  type: 'access';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // C-05 — no fallback secret. loadEnv() throws at boot if JWT_SECRET is unset.
      secretOrKey: loadEnv().jwtSecret,
    });
  }

  async validate(payload: AccessTokenPayload) {
    // Reject anything that is not explicitly an access token, so a credential
    // minted for another purpose cannot be replayed against the API.
    if (payload?.type !== 'access' || !payload.sub) {
      throw new UnauthorizedException('Invalid access token');
    }
    return { userId: payload.sub };
  }
}
