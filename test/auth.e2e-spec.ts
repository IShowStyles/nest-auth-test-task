import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/register (POST) - should cover controller and dto', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'test', password: 'password', fullName: 'Test User' })
      .expect(201);
  });

  it('/auth/me (GET) - should cover guard', () => {
    return request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer WRONG_TOKEN')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
