import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AccessGuard } from './guards/at.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    me: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(AccessGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });

    it('should have authService injected', () => {
      expect(authService).toBeDefined();
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto: RegisterDto = {
        username: 'testuser',
        password: 'Test123!@#',
        fullName: 'Test User',
      };

      const mockUser = {
        id: 1,
        username: 'testuser',
        fullName: 'Test User',
        password: 'hashed_password',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };

      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        fullName: mockUser.fullName,
        createdAt: mockUser.createdAt,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('updatedAt');
    });

    it('should handle registration with minimal data', async () => {
      const registerDto: RegisterDto = {
        username: 'minuser',
        password: 'Pass123!',
        fullName: 'Min User',
      };

      const mockUser = {
        id: 2,
        username: 'minuser',
        fullName: 'Min User',
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('fullName');
      expect(result).toHaveProperty('createdAt');
    });

    it('should propagate errors from auth service', async () => {
      const registerDto: RegisterDto = {
        username: 'existinguser',
        password: 'Test123!',
        fullName: 'Existing User',
      };

      const error = new Error('User already exists');
      mockAuthService.register.mockRejectedValue(error);

      await expect(controller.register(registerDto)).rejects.toThrow(
        'User already exists',
      );
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    it('should login user and return access token', async () => {
      const loginDto: LoginDto = {
        username: 'testuser',
        password: 'Test123!',
      };

      const mockToken = {
        accessToken: 'jwt.token.here',
      };

      mockAuthService.login.mockResolvedValue(mockToken);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockToken);
      expect(result).toHaveProperty('accessToken');
    });

    it('should handle different login credentials', async () => {
      const loginDto: LoginDto = {
        username: 'anotheruser',
        password: 'AnotherPass123!',
      };

      const mockToken = {
        accessToken: 'different.jwt.token',
      };

      mockAuthService.login.mockResolvedValue(mockToken);

      const result = await controller.login(loginDto);

      expect(result.accessToken).toBe('different.jwt.token');
    });

    it('should propagate login errors', async () => {
      const loginDto: LoginDto = {
        username: 'wronguser',
        password: 'wrongpass',
      };

      const error = new Error('Invalid credentials');
      mockAuthService.login.mockRejectedValue(error);

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle unauthorized access', async () => {
      const loginDto: LoginDto = {
        username: 'user',
        password: 'pass',
      };

      mockAuthService.login.mockRejectedValue(new Error('Unauthorized'));

      await expect(controller.login(loginDto)).rejects.toThrow('Unauthorized');
    });
  });

  describe('me', () => {
    it('should return current user data', async () => {
      const mockRequest = {
        user: {
          sub: 1,
          username: 'testuser',
        },
      };

      const mockUserData = {
        id: 1,
        username: 'testuser',
        fullName: 'Test User',
        createdAt: new Date('2024-01-01'),
      };

      mockAuthService.me.mockResolvedValue(mockUserData);

      const result = await controller.me(mockRequest);

      expect(authService.me).toHaveBeenCalledWith(1);
      expect(authService.me).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUserData);
    });

    it('should handle different user IDs', async () => {
      const mockRequest = {
        user: {
          sub: 42,
          username: 'anotheruser',
        },
      };

      const mockUserData = {
        id: 42,
        username: 'anotheruser',
        fullName: 'Another User',
        createdAt: new Date(),
      };

      mockAuthService.me.mockResolvedValue(mockUserData);

      const result = await controller.me(mockRequest);

      expect(authService.me).toHaveBeenCalledWith(42);
      expect(result.id).toBe(42);
    });

    it('should propagate errors from me endpoint', async () => {
      const mockRequest = {
        user: {
          sub: 999,
        },
      };

      const error = new Error('User not found');
      mockAuthService.me.mockRejectedValue(error);

      await expect(controller.me(mockRequest)).rejects.toThrow(
        'User not found',
      );
      expect(authService.me).toHaveBeenCalledWith(999);
    });

    it('should handle request with numeric user sub', async () => {
      const mockRequest = {
        user: {
          sub: 5,
        },
      };

      const mockUserData = {
        id: 5,
        username: 'user5',
        fullName: 'User Five',
        createdAt: new Date(),
      };

      mockAuthService.me.mockResolvedValue(mockUserData);

      const result = await controller.me(mockRequest);

      expect(authService.me).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockUserData);
    });
  });

  describe('guard integration', () => {
    it('should have AccessGuard applied to me endpoint', () => {
      const guards = Reflect.getMetadata('__guards__', controller.me);
      expect(guards).toBeDefined();
      expect(guards.length).toBeGreaterThan(0);
    });
  });

  describe('response filtering', () => {
    it('should not expose password in register response', async () => {
      const registerDto: RegisterDto = {
        username: 'secureuser',
        password: 'SecurePass123!',
        fullName: 'Secure User',
      };

      const mockUser = {
        id: 10,
        username: 'secureuser',
        fullName: 'Secure User',
        password: 'this_should_not_be_exposed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue(mockUser);

      const result = await controller.register(registerDto);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('fullName');
      expect(result).toHaveProperty('createdAt');
    });

    it('should only return specific fields from registration', async () => {
      const registerDto: RegisterDto = {
        username: 'fieldtest',
        password: 'Test123!',
        fullName: 'Field Test',
      };

      const mockUser = {
        id: 20,
        username: 'fieldtest',
        fullName: 'Field Test',
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        email: 'test@test.com',
        role: 'user',
      };

      mockAuthService.register.mockResolvedValue(mockUser as any);

      const result = await controller.register(registerDto);

      const resultKeys = Object.keys(result);
      expect(resultKeys).toEqual(['id', 'username', 'fullName', 'createdAt']);
      expect(resultKeys.length).toBe(4);
    });
  });
});
