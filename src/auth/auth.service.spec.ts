import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { DrizzleService } from '../common/db/db.service';
import { RedisService } from '../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;

  const dbMock = {
    select: jest.fn(),
    insert: jest.fn(),
  };

  const drizzleMock = {
    db: dbMock,
  };

  const redisClientMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  };

  const redisMock = {
    client: redisClientMock,
  };

  const jwtMock = {
    signAsync: jest.fn(),
  };

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 'LOGIN_FAIL_MAX') return 3;
      if (key === 'LOGIN_LOCK_SECONDS') return 60;
      if (key === 'ME_CACHE_SECONDS') return 30;
      return undefined;
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new AuthService(
      drizzleMock as unknown as DrizzleService,
      redisMock as unknown as RedisService,
      jwtMock as unknown as JwtService,
      configMock as unknown as ConfigService,
    );
  });

  /* ========================= REGISTER ========================= */

  it('register: throws if username already exists', async () => {
    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: '1' }]),
        }),
      }),
    });

    await expect(
      service.register({
        username: 'alex',
        password: '123',
        fullName: 'Alex',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('register: creates user successfully', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('HASH');

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    dbMock.insert.mockReturnValue({
      values: () => ({
        returning: () =>
          Promise.resolve([
            {
              id: 'u1',
              username: 'alex',
              fullName: 'Alex',
              createdAt: new Date(),
            },
          ]),
      }),
    });

    const res = await service.register({
      username: 'alex',
      password: '123',
      fullName: 'Alex',
    });

    expect(res.username).toBe('alex');
  });

  /* ========================= LOGIN ========================= */

  it('login: throws if account is locked', async () => {
    redisClientMock.get.mockResolvedValue('1');

    await expect(
      service.login({ username: 'alex', password: '123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login: bumps fail if user not found', async () => {
    redisClientMock.get.mockResolvedValue(null);
    redisClientMock.incr.mockResolvedValue(1);

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    await expect(
      service.login({ username: 'alex', password: '123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redisClientMock.incr).toHaveBeenCalled();
  });

  it('login: bumps fail if password invalid', async () => {
    redisClientMock.get.mockResolvedValue(null);
    redisClientMock.incr.mockResolvedValue(2);

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 'u1', passwordHash: 'HASH' }]),
        }),
      }),
    });

    await expect(
      service.login({ username: 'alex', password: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login: returns JWT on success and resets counters', async () => {
    redisClientMock.get.mockResolvedValue(null);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    jwtMock.signAsync.mockResolvedValue('JWT');

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: 'u1', username: 'alex', passwordHash: 'HASH' },
            ]),
        }),
      }),
    });

    const res = await service.login({
      username: 'alex',
      password: '123',
    });

    expect(res.accessToken).toBe('JWT');
    expect(redisClientMock.del).toHaveBeenCalled();
  });

  /* ========================= ME ========================= */

  it('me: returns cached user', async () => {
    redisClientMock.get.mockResolvedValue(
      JSON.stringify({ id: 'u1', username: 'alex' }),
    );

    const res = await service.me('u1');

    expect(res.username).toBe('alex');
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('me: fetches user and caches result', async () => {
    redisClientMock.get.mockResolvedValue(null);

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([{ id: 'u1', username: 'alex', fullName: 'Alex' }]),
        }),
      }),
    });

    const res = await service.me('u1');

    expect(res.id).toBe('u1');
    expect(redisClientMock.set).toHaveBeenCalled();
  });

  it('me: throws if user not found', async () => {
    redisClientMock.get.mockResolvedValue(null);

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    await expect(service.me('missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: locks account when failMax is reached', async () => {
    redisClientMock.get.mockResolvedValue(null);

    redisClientMock.incr.mockResolvedValue(3);

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              { id: 'u1', username: 'alex', passwordHash: 'HASH' },
            ]),
        }),
      }),
    });

    await expect(
      service.login({ username: 'alex', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(redisClientMock.set).toHaveBeenCalledWith(
      'auth:lock:alex',
      '1',
      'EX',
      60,
    );
  });
});
