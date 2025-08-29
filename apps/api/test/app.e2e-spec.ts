import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, it } from 'node:test';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Insurance API (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    it('/auth/login (POST) - should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@insurance.com',
          password: 'admin123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.access_token).toBeDefined();
          expect(res.body.role).toBe('admin');
          expect(res.body.expires_in).toBe(3600);
          authToken = res.body.access_token;
        });
    });

    it('/auth/login (POST) - should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'wrong@email.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Health Check', () => {
    it('/health (GET) - should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
        });
    });
  });

  describe('Insurance Endpoints', () => {
    beforeEach(async () => {
      // Get auth token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@insurance.com',
          password: 'admin123',
        });
      authToken = loginResponse.body.access_token;
    });

    it('/insurance/policy (GET) - should get policy details', () => {
      return request(app.getHttpServer())
        .get('/insurance/policy')
        .query({ user_id: 'USER-001' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.user_id).toBe('USER-001');
          expect(res.body.policy_id).toBeDefined();
          expect(res.body.plan).toBeDefined();
        });
    });

    it('/insurance/claims (GET) - should get claim status', () => {
      return request(app.getHttpServer())
        .get('/insurance/claims')
        .query({ claim_id: '98765' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.claim_id).toBe('98765');
          expect(res.body.status).toBeDefined();
          expect(res.body.last_updated).toBeDefined();
        });
    });

    it('/insurance/claims (POST) - should submit new claim', () => {
      return request(app.getHttpServer())
        .post('/insurance/claims')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          policy_id: 'POL-001',
          damage_description: 'Vehicle damaged in collision with another car',
          vehicle: 'Toyota Camry 2020',
          photos: ['photo1.jpg'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.claim_id).toBeDefined();
          expect(res.body.message).toBeDefined();
        });
    });

    it('/insurance/premium (POST) - should calculate premium', () => {
      return request(app.getHttpServer())
        .post('/insurance/premium')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          policy_id: 'POL-001',
          current_coverage: 50000,
          new_coverage: 80000,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.policy_id).toBe('POL-001');
          expect(res.body.current_premium).toBeDefined();
          expect(res.body.new_premium).toBeDefined();
        });
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@insurance.com',
          password: 'admin123',
        });
      authToken = loginResponse.body.access_token;
    });

    it('should reject invalid claim_id format', () => {
      return request(app.getHttpServer())
        .get('/insurance/claims')
        .query({ claim_id: 'INVALID@CLAIM#ID' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject premium calculation with new_coverage <= current_coverage', () => {
      return request(app.getHttpServer())
        .post('/insurance/premium')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          policy_id: 'POL-001',
          current_coverage: 80000,
          new_coverage: 50000, // Less than current
        })
        .expect(400);
    });
  });
});
