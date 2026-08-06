import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    identity: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    creditBalance: {
      create: jest.fn(),
    },
    ttsSettings: {
      create: jest.fn(),
    },
  };

  const mockSessionService = {
    issue: jest.fn().mockResolvedValue({
      token: 'mock-refresh-token',
      sessionId: 'session-123',
      familyId: 'family-123',
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    }),
    rotate: jest.fn(),
    revokeByToken: jest.fn().mockResolvedValue(true),
    revokeAllForUser: jest.fn().mockResolvedValue(1),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email is already registered', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-1', email: 'test@example.com' });

      await expect(
        service.register({ email: 'test@example.com', password: 'Password123', displayName: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create user, credit balance, tts settings and return tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: 'user-new',
        email: 'new@example.com',
        displayName: 'New User',
        passwordHash: 'hashed',
      });

      const res = await service.register({
        email: 'new@example.com',
        password: 'Password123',
        displayName: 'New User',
      });

      expect(res.accessToken).toBe('mock-access-token');
      expect(res.refreshToken).toBe('mock-refresh-token');
      expect(mockPrismaService.creditBalance.create).toHaveBeenCalledWith({
        data: { userId: 'user-new', balance: 100 },
      });
      expect(mockPrismaService.ttsSettings.create).toHaveBeenCalled();
    });
  });

  describe('forgotPassword & resetPassword', () => {
    it('should return reset token for valid email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
      });

      const res = await service.forgotPassword('user@example.com');
      expect(res.success).toBe(true);
      expect(res.resetToken).toBeDefined();
    });

    it('should reset password when given valid token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
      });

      const forgot = await service.forgotPassword('user@example.com');
      const resetToken = forgot.resetToken!;

      mockPrismaService.user.update.mockResolvedValueOnce({ id: 'user-1' });

      const success = await service.resetPassword(resetToken, 'NewPassword123');
      expect(success).toBe(true);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });
  });
});
