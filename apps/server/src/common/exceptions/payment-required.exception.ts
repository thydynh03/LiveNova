import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 402 Payment Required.
 *
 * Nest ships no built-in for this status, but the distinction matters here:
 * "you are out of credits" is not a malformed request (400) and not a
 * permissions problem (403). Callers branch on it to keep overlays, PK bars and
 * leaderboards running while only TTS stops — BR-10.
 */
export class PaymentRequiredException extends HttpException {
  constructor(message = 'Insufficient credits') {
    super(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, message, error: 'Payment Required' },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
