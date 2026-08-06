import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';
import { EmailModule } from '../email/email.module';
import { loadEnv } from '../../common/config/env';

@Module({
  imports: [
    UserModule,
    EmailModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        // C-05 — resolved through loadEnv() so a missing secret aborts startup
        // instead of silently falling back to a guessable default.
        const env = loadEnv();
        return {
          secret: env.jwtSecret,
          signOptions: { expiresIn: env.accessTokenTtl },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService, JwtStrategy],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
