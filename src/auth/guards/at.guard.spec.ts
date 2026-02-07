import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccessGuard } from './at.guard';
import { Request } from 'express';

describe('AccessGuard', () => {
  let guard: AccessGuard;
  let jwtService: JwtService;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessGuard,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    guard = module.get<AccessGuard>(AccessGuard);
    jwtService = module.get<JwtService>(JwtService);

    process.env.JWT_ACCESS_TOKEN_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockExecutionContext = (
    authorizationHeader?: string,
  ): ExecutionContext => {
    const mockRequest = {
      headers: {
        authorization: authorizationHeader,
      },
    } as Request;

    return {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ExecutionContext;
  };

  describe('constructor', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });

    it('should have jwtService injected', () => {
      expect(jwtService).toBeDefined();
    });
  });

  describe('canActivate', () => {
    it('should return true for valid token', async () => {
      const mockPayload = {
        sub: 1,
        username: 'testuser',
        iat: Date.now(),
        exp: Date.now() + 3600,
      };

      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const context = createMockExecutionContext('Bearer valid.jwt.token');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid.jwt.token', {
        secret: 'test-secret-key',
      });
    });

    it('should attach user payload to request', async () => {
      const mockPayload = {
        sub: 42,
        username: 'john',
        role: 'admin',
      };

      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const context = createMockExecutionContext('Bearer test.token');
      const request = context.switchToHttp().getRequest();

      await guard.canActivate(context);

      expect(request['user']).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing access token',
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when authorization header is empty', async () => {
      const context = createMockExecutionContext('');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing access token',
      );
    });

    it('should throw UnauthorizedException for invalid token format', async () => {
      const context = createMockExecutionContext('InvalidFormat token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing access token',
      );
    });

    it('should throw UnauthorizedException when Bearer keyword is missing', async () => {
      const context = createMockExecutionContext('token.without.bearer');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing access token',
      );
    });

    it('should throw UnauthorizedException for expired token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Token expired'));

      const context = createMockExecutionContext('Bearer expired.token');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired access token',
      );
    });

    it('should throw UnauthorizedException for invalid token signature', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('Invalid signature'),
      );

      const context = createMockExecutionContext('Bearer invalid.signature');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired access token',
      );
    });

    it('should throw UnauthorizedException for malformed token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(
        new Error('Malformed token'),
      );

      const context = createMockExecutionContext('Bearer malformed');

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired access token',
      );
    });

    it('should handle token with correct Bearer prefix', async () => {
      const mockPayload = { sub: 1, username: 'user' };
      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const context = createMockExecutionContext('Bearer correct.token.format');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith(
        'correct.token.format',
        { secret: 'test-secret-key' },
      );
    });

    it('should use correct JWT secret from environment', async () => {
      const mockPayload = { sub: 1 };
      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const context = createMockExecutionContext('Bearer token');

      await guard.canActivate(context);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('token', {
        secret: 'test-secret-key',
      });
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer my.jwt.token',
        },
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBe('my.jwt.token');
    });

    it('should return undefined when authorization header is missing', () => {
      const mockRequest = {
        headers: {},
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBeUndefined();
    });

    it('should return undefined when authorization type is not Bearer', () => {
      const mockRequest = {
        headers: {
          authorization: 'Basic base64credentials',
        },
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBeUndefined();
    });

    it('should return undefined when authorization header has wrong format', () => {
      const mockRequest = {
        headers: {
          authorization: 'JustAToken',
        },
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBeUndefined();
    });

    it('should handle authorization header with extra spaces', () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer  token.with.spaces',
        },
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBe('token.with.spaces');
    });

    it('should return undefined for empty authorization header', () => {
      const mockRequest = {
        headers: {
          authorization: '',
        },
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBeUndefined();
    });

    it('should extract token from authorization header case-sensitively', () => {
      const mockRequest = {
        headers: {
          authorization: 'bearer lowercase.token',
        },
      } as Request;

      const token = guard['extractTokenFromHeader'](mockRequest);

      expect(token).toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    it('should successfully authenticate valid request', async () => {
      const mockPayload = {
        sub: 100,
        username: 'integrationtest',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);

      const context = createMockExecutionContext(
        'Bearer integration.test.token',
      );
      const request = context.switchToHttp().getRequest();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request['user']).toEqual(mockPayload);
      expect(request['user'].sub).toBe(100);
      expect(request['user'].username).toBe('integrationtest');
    });

    it('should reject request with missing authorization header', async () => {
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Missing access token',
      );
    });

    it('should reject request with invalid token', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid'));

      const context = createMockExecutionContext('Bearer invalid');

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Invalid or expired access token',
      );
    });
  });
});
