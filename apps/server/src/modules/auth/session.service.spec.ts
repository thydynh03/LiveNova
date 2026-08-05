import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';

interface PrismaMock {
  session: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
}

function makePrisma(): PrismaMock {
  return {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

describe('SessionService (C-06)', () => {
  let prisma: PrismaMock;
  let service: SessionService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new SessionService(prisma as unknown as PrismaService);
    prisma.session.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({ id: 'sess-1', ...data }),
    );
  });

  it('issues a high-entropy opaque token and stores only its hash', async () => {
    const issued = await service.issue('u1');

    // 32 random bytes as base64url.
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const stored = prisma.session.create.mock.calls[0][0].data.refreshHash;
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    // The raw token must never be recoverable from the row.
    expect(stored).not.toContain(issued.token);
  });

  it('rejects an unknown refresh token', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(service.rotate('bogus')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired refresh token', async () => {
    const issued = await service.issue('u1');
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      userId: 'u1',
      familyId: 'fam-1',
      refreshHash: prisma.session.create.mock.calls[0][0].data.refreshHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.rotate(issued.token)).rejects.toThrow('expired');
  });

  it('rotates a valid token and revokes the presented one', async () => {
    const issued = await service.issue('u1');
    const hash = prisma.session.create.mock.calls[0][0].data.refreshHash;

    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      userId: 'u1',
      familyId: 'fam-1',
      refreshHash: hash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const result = await service.rotate(issued.token);

    expect(result.userId).toBe('u1');
    expect(result.refresh.token).not.toBe(issued.token);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: { revokedAt: expect.any(Date) },
    });
    // The successor stays in the same rotation family.
    expect(prisma.session.create.mock.calls[1][0].data.familyId).toBe('fam-1');
  });

  it('revokes the whole family when a consumed token is replayed', async () => {
    const issued = await service.issue('u1');
    const hash = prisma.session.create.mock.calls[0][0].data.refreshHash;

    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-1',
      userId: 'u1',
      familyId: 'fam-99',
      refreshHash: hash,
      revokedAt: new Date(), // already rotated
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await expect(service.rotate(issued.token)).rejects.toThrow('reuse detected');

    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'fam-99', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('actually revokes on logout instead of reporting success (C-06)', async () => {
    prisma.session.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.revokeByToken('some-token')).resolves.toBe(true);
    expect(prisma.session.updateMany).toHaveBeenCalled();
  });

  it('reports false when logout matched no live session', async () => {
    prisma.session.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.revokeByToken('stale')).resolves.toBe(false);
  });

  it('never returns token material when listing sessions (FR-007)', async () => {
    await service.listActive('u1');
    const select = prisma.session.findMany.mock.calls[0][0].select;
    expect(select.refreshHash).toBeUndefined();
    expect(select).toEqual(
      expect.objectContaining({ id: true, ip: true, userAgent: true }),
    );
  });
});
