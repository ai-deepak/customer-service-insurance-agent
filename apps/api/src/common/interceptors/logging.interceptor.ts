import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // Ensure request id and trace id
    let requestId: string = req.headers['x-request-id'];
    if (!requestId) {
      requestId = randomUUID();
      req.headers['x-request-id'] = requestId;
    }

    const traceId = req.headers['x-trace-id'] || randomUUID();
    req.headers['x-trace-id'] = traceId;

    const method = req.method;
    const url = req.originalUrl || req.url;
    const userAgent = req.headers['user-agent'];
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.user?.userId || 'anonymous';
    const userRole = req.user?.role || 'none';
    const start = Date.now();

    // Log request start
    const requestLog = {
      type: 'request_start',
      timestamp: new Date().toISOString(),
      requestId,
      traceId,
      method,
      url,
      userAgent,
      ip,
      userId,
      userRole,
      headers: this.sanitizeHeaders(req.headers),
    };
    
    this.logger.log(JSON.stringify(requestLog));

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const statusCode = res.statusCode;
        
        const responseLog = {
          type: 'request_complete',
          timestamp: new Date().toISOString(),
          requestId,
          traceId,
          method,
          url,
          statusCode,
          latency_ms: durationMs,
          userId,
          userRole,
          success: statusCode < 400,
        };
        
        this.logger.log(JSON.stringify(responseLog));
      }),
      catchError((error) => {
        const durationMs = Date.now() - start;
        const statusCode = error.status || 500;
        
        const errorLog = {
          type: 'request_error',
          timestamp: new Date().toISOString(),
          requestId,
          traceId,
          method,
          url,
          statusCode,
          latency_ms: durationMs,
          userId,
          userRole,
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
        };
        
        this.logger.error(JSON.stringify(errorLog));
        return throwError(() => error);
      }),
    );
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }
}
