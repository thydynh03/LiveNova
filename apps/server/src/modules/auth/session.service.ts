import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadEnv } from '../../common/config/env';

export interface IssuedRefreshToken {
  token: string;
  sessionId: string;
  familyId: string;
  expiresAt: Date;
}

export interface RefreshContext {
  ip?: string;
  userAgent?: string;
}

/**
 * C-06 / FR-006, FR-007, FR-008 — server-side refresh token lifecycle.
 *
 * Refresh tokens are opaque 256-bit random strings, not JWTs. A JWT refresh
 * token cannot be revoked without a server-side record anyway, so the JWT bought
 * nothing and cost us the ability to log out. Only an HMAC of the token is
 * stored, keyed with JWT_REFRESH_SECRET, so a database leak does not yield
 * usable credentials.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly env = loadEnv();

  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return createHmac('sha256', this.env.jwtRefreshSecret).update(token).digest('hex');
  }

  private static safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private expiryDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + this.env.refreshTokenTtlDays);
    return d;
  }

  /** Starts a brand-new rotation family (i.e. a fresh login). */
  async issue(userId: string, ctx: RefreshContext = {}): Promise<IssuedRefreshToken> {
    const familyId = randomBytes(16).toString('hex');
    return this.createSession(userId, familyId, ctx);
  }

  private async createSession(
    userId: string,
    familyId: string,
    ctx: RefreshContext,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = this.expiryDate();

    const session = await this.prisma.session.create({
      data: {
        userId,
        familyId,
        refreshHash: this.hash(token),
        ip: ctx.ip,
        userAgent: ctx.userAgent?.slice(0, 512),
        expiresAt,
      },
    });

    return { token, sessionId: session.id, familyId, expiresAt };
  }

  /**
   * Validates and rotates a refresh token.
   *
   * Reuse detection: a token that exists but is already revoked means someone is
   * replaying a consumed credential. We cannot tell whether that is the attacker
   * or the legitimate user, so the entire family is revoked and both parties are
   * forced to re-authenticate.
   */
  async rotate(
    presentedToken: string,
    ctx: RefreshContext = {},
  ): Promise<{ userId: string; refresh: IssuedRefreshToken }> {
    const presentedHash = this.hash(presentedToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshHash: presentedHash },
    });

    if (!session || !SessionService.safeEquals(session.refreshHash, presentedHash)) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.revokedAt) {
      this.logger.warn(
        `Refresh token reuse detected for user ${session.userId}; revoking family ${session.familyId}`,
      );
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException('Refresh token reuse detected; all sessions revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Consume the presented token, then mint its successor in the same family.
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const refresh = await this.createSession(session.userId, session.familyId, ctx);
    return { userId: session.userId, refresh };
  }

  /** FR-008 — revoke a single presented credential (logout on this device). */
  async revokeByToken(presentedToken: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { refreshHash: this.hash(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** FR-008 — logout everywhere. */
  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /** FR-007 — list active sessions. Never returns token material. */
  async listActive(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return sessions;
  }

  async revokeById(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count > 0;
  }

  /** Housekeeping — drop rows that can no longer authenticate anything. */
  async pruneExpired(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return result.count;
  }
}
