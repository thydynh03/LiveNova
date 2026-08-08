import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

function contextFor(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: userId ? { userId } : undefined }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: { user: { findUnique: jest.Mock } };
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]) };
    prisma = { user: { findUnique: jest.fn() } };
    guard = new RolesGuard(
      reflector as unknown as Reflector,
      prisma as unknown as PrismaService,
    );
  });

  it('lets an admin through', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN, deletedAt: null });

    await expect(guard.canActivate(contextFor('u1'))).resolves.toBe(true);
  });

  it('refuses an ordinary user', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: Role.USER, deletedAt: null });

    await expect(guard.canActivate(contextFor('u1'))).rejects.toThrow(ForbiddenException);
  });

  it('refuses a suspended admin', async () => {
    // `deletedAt` is how the product marks an account gone. An admin who was
    // locked out must not keep admin access because their role column still
    // says ADMIN.
    prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN, deletedAt: new Date() });

    await expect(guard.canActivate(contextFor('u1'))).rejects.toThrow(ForbiddenException);
  });

  it('refuses when the account no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor('u1'))).rejects.toThrow(ForbiddenException);
  });

  it('refuses an unauthenticated request instead of letting it pass', async () => {
    // Reached with no user means the guard chain is misordered. Failing open
    // here would turn a wiring mistake into an unauthenticated admin API.
    await expect(guard.canActivate(contextFor(undefined))).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows a route with no @Roles — it has nothing to say there', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(contextFor('u1'))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('reads the role from the database, not from the token', async () => {
    // An access token lives 15 minutes. Trusting a role claim inside it would
    // leave a demoted admin with full access for the rest of that window.
    prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN, deletedAt: null });

    await guard.canActivate(contextFor('u1'));

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
  });

  it('gives the same answer for every refusal so roles cannot be probed', async () => {
    const messages: string[] = [];

    for (const row of [
      { role: Role.USER, deletedAt: null },
      { role: Role.ADMIN, deletedAt: new Date() },
      null,
    ]) {
      prisma.user.findUnique.mockResolvedValue(row);
      await guard.canActivate(contextFor('u1')).catch((err: Error) => messages.push(err.message));
    }

    expect(new Set(messages).size).toBe(1);
  });
});
