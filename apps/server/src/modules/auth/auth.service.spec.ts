import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('AuthService', () => {
  let service: AuthService;

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
    otpCode: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
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

  const mockEmailService = {
    sendOtp: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SessionService, useValue: mockSessionService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email is already registered and verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
      });

      await expect(
        service.register({ email: 'test@example.com', password: 'Password123', displayName: 'Test' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully create user, credit balance, tts settings and send OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: 'user-new',
        email: 'new@example.com',
        displayName: 'New User',
        passwordHash: 'hashed',
        emailVerified: false,
      });

      const res = await service.register({
        email: 'new@example.com',
        password: 'Password123',
        displayName: 'New User',
      });

      expect(res.pendingVerification).toBe(true);
      expect(res.email).toBe('new@example.com');
      expect(mockPrismaService.creditBalance.create).toHaveBeenCalledWith({
        data: { userId: 'user-new', balance: 100 },
      });
      expect(mockPrismaService.ttsSettings.create).toHaveBeenCalled();
      expect(mockEmailService.sendOtp).toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('should return success true for email and send OTP', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash: 'hash',
      });

      const res = await service.forgotPassword('user@example.com');
      expect(res.success).toBe(true);
      expect(mockEmailService.sendOtp).toHaveBeenCalled();
    });
  });
});
