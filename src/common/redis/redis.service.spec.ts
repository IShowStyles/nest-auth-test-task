import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let configService: ConfigService;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: RedisService,
          useFactory: (config: ConfigService) => {
            const mockService = new RedisService(config);
            (mockService as any).client = mockRedisClient;
            return mockService;
          },
          inject: [ConfigService],
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have Redis client instance', () => {
      expect(service.client).toBeDefined();
      expect(service.client).toBe(mockRedisClient);
    });

    it('should use ConfigService to get configuration', () => {
      expect(configService.get).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call quit on Redis client', async () => {
      mockRedisClient.quit.mockResolvedValue('OK');

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle quit errors gracefully', async () => {
      const error = new Error('Quit failed');
      mockRedisClient.quit.mockRejectedValue(error);

      await expect(service.onModuleDestroy()).rejects.toThrow('Quit failed');
    });
  });

  describe('get', () => {
    it('should retrieve value by key', async () => {
      const key = 'test-key';
      const expectedValue = 'test-value';
      mockRedisClient.get.mockResolvedValue(expectedValue);

      const result = await service.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBe(expectedValue);
    });

    it('should return null for non-existent key', async () => {
      const key = 'non-existent';
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get(key);

      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toBeNull();
    });

    it('should handle Redis errors', async () => {
      const key = 'error-key';
      const error = new Error('Redis connection failed');
      mockRedisClient.get.mockRejectedValue(error);

      await expect(service.get(key)).rejects.toThrow('Redis connection failed');
    });
  });

  describe('set', () => {
    it('should set value without TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should set value with TTL', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 3600;
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set(key, value, ttl);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
    });

    it('should set value with zero TTL (edge case)', async () => {
      const key = 'test-key';
      const value = 'test-value';
      const ttl = 0;
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set(key, value, ttl);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    });

    it('should handle set errors', async () => {
      const key = 'error-key';
      const value = 'error-value';
      const error = new Error('Set operation failed');
      mockRedisClient.set.mockRejectedValue(error);

      await expect(service.set(key, value)).rejects.toThrow(
        'Set operation failed',
      );
    });

    it('should set empty string value', async () => {
      const key = 'empty-key';
      const value = '';
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set(key, value);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value);
    });
  });

  describe('del', () => {
    it('should delete key', async () => {
      const key = 'test-key';
      mockRedisClient.del.mockResolvedValue(1);

      await service.del(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(mockRedisClient.del).toHaveBeenCalledTimes(1);
    });

    it('should delete non-existent key', async () => {
      const key = 'non-existent';
      mockRedisClient.del.mockResolvedValue(0);

      await service.del(key);

      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
    });

    it('should handle delete errors', async () => {
      const key = 'error-key';
      const error = new Error('Delete operation failed');
      mockRedisClient.del.mockRejectedValue(error);

      await expect(service.del(key)).rejects.toThrow('Delete operation failed');
    });
  });

  describe('integration scenarios', () => {
    it('should set and get value successfully', async () => {
      const key = 'integration-key';
      const value = 'integration-value';

      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(value);

      await service.set(key, value);
      const result = await service.get(key);

      expect(result).toBe(value);
    });

    it('should set with TTL and get value successfully', async () => {
      const key = 'ttl-key';
      const value = 'ttl-value';
      const ttl = 60;

      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(value);

      await service.set(key, value, ttl);
      const result = await service.get(key);

      expect(mockRedisClient.set).toHaveBeenCalledWith(key, value, 'EX', ttl);
      expect(result).toBe(value);
    });

    it('should handle set, get, and delete cycle', async () => {
      const key = 'cycle-key';
      const value = 'cycle-value';

      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.get
        .mockResolvedValueOnce(value)
        .mockResolvedValueOnce(null);
      mockRedisClient.del.mockResolvedValue(1);

      await service.set(key, value);
      const beforeDelete = await service.get(key);
      await service.del(key);
      const afterDelete = await service.get(key);

      expect(beforeDelete).toBe(value);
      expect(afterDelete).toBeNull();
    });
  });
});
