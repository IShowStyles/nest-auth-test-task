import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

import { DrizzleService } from '../common/db/db.service';
import { RedisService } from '../common/redis/redis.service';
import { users } from '../common/db/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly failMax: number;
  private readonly lockSeconds: number;
  private readonly meCacheSeconds: number;

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.failMax = config.get<number>('LOGIN_FAIL_MAX', { infer: true });
    this.lockSeconds = config.get<number>('LOGIN_LOCK_SECONDS', {
      infer: true,
    });
    this.meCacheSeconds = config.get<number>('ME_CACHE_SECONDS', {
      infer: true,
    });
  }

  private failKey(username: string) {
    return `auth:fail:${username}`;
  }

  private lockKey(username: string) {
    return `auth:lock:${username}`;
  }

  private meKey(userId: string) {
    return `auth:me:${userId}`;
  }

  async register(dto: RegisterDto) {
    const existing = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException('username already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.drizzle.db
      .insert(users)
      .values({
        username: dto.username,
        fullName: dto.fullName,
        passwordHash,
      })
      .returning();

    return {
      id: created[0].id,
      username: created[0].username,
      fullName: created[0].fullName,
      createdAt: created[0].createdAt,
    };
  }

  async login(dto: LoginDto) {
    if (await this.redis.client.get(this.lockKey(dto.username))) {
      throw new UnauthorizedException('account temporarily locked');
    }

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.username, dto.username))
      .limit(1);

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.bumpFail(dto.username);
      throw new UnauthorizedException('invalid credentials');
    }

    await this.redis.client.del(this.failKey(dto.username));
    await this.redis.client.del(this.lockKey(dto.username));

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        username: user.username,
      },
      {
        expiresIn: '15m',
      },
    );

    return { accessToken };
  }

  async me(userId: string) {
    const cacheKey = this.meKey(userId);

    const cached = await this.redis.client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const found = await this.drizzle.db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (found.length === 0) {
      throw new UnauthorizedException('user not found');
    }

    await this.redis.client.set(
      cacheKey,
      JSON.stringify(found[0]),
      'EX',
      this.meCacheSeconds,
    );

    return found[0];
  }
  private async bumpFail(username: string) {
    const key = this.failKey(username);

    const count = await this.redis.client.incr(key);

    if (count === 1) {
      await this.redis.client.expire(key, this.lockSeconds);
    }

    if (count >= this.failMax) {
      await this.redis.client.set(
        this.lockKey(username),
        '1',
        'EX',
        this.lockSeconds,
      );
    }
  }
}
