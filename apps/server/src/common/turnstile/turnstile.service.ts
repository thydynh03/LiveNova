import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

/**
 * Cloudflare Turnstile verification.
 *
 * Runs here, in the API, and not in the Next.js BFF that sits in front of it.
 * That is the whole decision: `POST /auth/login` on this service is reachable
 * directly — a plain `curl` against it answers, because CORS constrains
 * browsers and nothing else. A check in the BFF would only inconvenience
 * people who came through the website, which is precisely not the traffic
 * being defended against.
 *
 * Fails closed. If Cloudflare is unreachable, or answers with a non-2xx, or
 * returns something that is not JSON, the request is refused rather than waved
 * through. The opposite choice removes the protection at exactly the moment
 * somebody is motivated to attack the verification path itself.
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare answers in well under a second; past this it is not answering. */
const TIMEOUT_MS = 5_000;

interface SiteverifyResponse {
  success?: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
}

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);

  /**
   * Whether verification is switched on.
   *
   * Absence of the secret is a configuration state, not a verification
   * failure — so it is handled separately from the fail-closed rule above.
   * `loadEnv` refuses to boot production without it, so an unset secret here
   * can only mean a developer machine or the test suite, where demanding a
   * real Cloudflare challenge would make the login form unusable offline.
   */
  private get secret(): string | undefined {
    return process.env.TURNSTILE_SECRET;
  }

  isEnabled(): boolean {
    return Boolean(this.secret);
  }

  /**
   * Throws unless Cloudflare confirms the token.
   *
   * `remoteIp` is the visitor's address, which Cloudflare uses as a signal.
   * It is optional in the API and passed when known.
   */
  async assertHuman(token: string | undefined, remoteIp?: string): Promise<void> {
    const secret = this.secret;
    if (!secret) return;

    if (!token) {
      throw new ForbiddenException('Vui lòng hoàn tất bước xác minh trước khi tiếp tục.');
    }

    const body = new URLSearchParams({ secret, response: token });
    // Only send an address we actually have. An empty string is not a missing
    // value to Cloudflare — it is an invalid one.
    if (remoteIp) body.set('remoteip', remoteIp);

    let result: SiteverifyResponse;
    try {
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`siteverify ${res.status}`);
      result = (await res.json()) as SiteverifyResponse;
    } catch (err) {
      this.logger.error(
        `Khong goi duoc siteverify: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ForbiddenException('Khong xac minh duoc. Vui long thu lai.');
    }

    if (result.success !== true) {
      const codes = result['error-codes'] ?? [];
      // `timeout-or-duplicate` is the common one and it is not an attack: a
      // token is redeemable exactly once, so a retry that reuses the token from
      // a failed first attempt lands here. The widget is reset on the client
      // for that reason; logging the code keeps the two ends debuggable.
      this.logger.warn(`Turnstile tu choi token: ${codes.join(', ') || 'khong ro'}`);
      throw new ForbiddenException('Xác minh thất bại. Vui lòng thử lại.');
    }
  }
}
