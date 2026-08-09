import { Global, Module } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

/**
 * Global because bot verification is not the auth module's private concern —
 * any endpoint a visitor can reach without a session may need it later.
 */
@Global()
@Module({
  providers: [TurnstileService],
  exports: [TurnstileService],
})
export class TurnstileModule {}
