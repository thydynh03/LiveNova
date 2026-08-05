import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Platform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * H-07 / FR-011, FR-012 — channel ownership.
 *
 * Without this, `channelId` was an unvalidated free-text string that any client
 * could supply, which is the root cause of C-04 (subscribing to another
 * streamer's event feed) and of the ingest controller connecting to arbitrary
 * channels.
 */
@Injectable()
export class ChannelService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    return this.prisma.channel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Links a channel in unverified state and issues a verification code the user
   * must publish on the channel profile. Nothing may be ingested until
   * `verify()` succeeds.
   */
  async link(userId: string, platform: Platform, platformChannelId: string, handle: string) {
    const existing = await this.prisma.channel.findUnique({
      where: { platform_platformChannelId: { platform, platformChannelId } },
    });

    if (existing) {
      // BR-16 — one platform channel, one account. Do not reveal who owns it.
      throw new ConflictException('This channel is already linked to an account');
    }

    return this.prisma.channel.create({
      data: {
        userId,
        platform,
        platformChannelId,
        handle,
        verificationCode: `livenova-${randomBytes(8).toString('hex')}`,
      },
    });
  }

  /**
   * ⚠️ Q-12 UNRESOLVED — the ownership proof mechanism is undecided.
   *
   * The intended flow is: user puts `verificationCode` in their channel bio, we
   * read the public profile and compare. That read depends on the same data
   * access decision as Q-01, so the check is not implemented. Until it is, this
   * method refuses rather than granting unverified access.
   */
  async verify(userId: string, channelId: string): Promise<never> {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, userId },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    throw new BadRequestException(
      'Channel ownership verification is not available yet (blocked on Q-12). ' +
        'A channel cannot be verified until the profile-read mechanism is chosen.',
    );
  }

  async unlink(userId: string, channelId: string) {
    const result = await this.prisma.channel.deleteMany({
      where: { id: channelId, userId },
    });
    if (result.count === 0) throw new NotFoundException('Channel not found');
    return { success: true };
  }

  /**
   * The single authorisation check used by both the ingest controller and the
   * WebSocket gateway. Returns the channel only if this user owns it AND it has
   * passed ownership verification.
   */
  async assertOwnedAndVerified(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, userId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    if (!channel.verified) {
      throw new BadRequestException('Channel ownership has not been verified');
    }
    return channel;
  }

  /** Non-throwing variant for the socket layer, which should just refuse quietly. */
  async isOwnedBy(userId: string, channelId: string): Promise<boolean> {
    const count = await this.prisma.channel.count({
      where: { id: channelId, userId },
    });
    return count > 0;
  }
}
