import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Ensure request id
    let requestId: string = req.headers['x-request-id'];
    if (!requestId) {
      requestId = randomUUID();
      req.headers['x-request-id'] = requestId;
    }

    const method = req.method;
    const url = req.originalUrl || req.url;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;
        // Simple console logging; in production route to pino/winston
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            requestId,
            method,
            url,
            statusCode,
            latency_ms: durationMs,
          }),
        );
      }),
    );
  }
}
