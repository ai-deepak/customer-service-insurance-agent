import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly register: client.Registry;
  private readonly httpRequestsTotal: client.Counter;
  private readonly httpRequestDuration: client.Histogram;
  private readonly authAttemptsTotal: client.Counter;
  private readonly orchestratorRequestsTotal: client.Counter;

  constructor(private configService: ConfigService) {
    // Create a custom registry
    this.register = new client.Registry();

    // Add default metrics (memory, cpu, etc.)
    client.collectDefaultMetrics({ register: this.register });

    // Custom metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });

    this.authAttemptsTotal = new client.Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['result'], // 'success' or 'failure'
      registers: [this.register],
    });

    this.orchestratorRequestsTotal = new client.Counter({
      name: 'orchestrator_requests_total',
      help: 'Total number of requests to orchestrator',
      labelNames: ['status'], // 'success' or 'error'
      registers: [this.register],
    });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  observeHttpDuration(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  incrementAuthAttempts(result: 'success' | 'failure'): void {
    this.authAttemptsTotal.inc({ result });
  }

  incrementOrchestratorRequests(status: 'success' | 'error'): void {
    this.orchestratorRequestsTotal.inc({ status });
  }
}
