import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    
    // Add traceId for tracking (NFR-24)
    req.traceId = req.headers['x-trace-id'] || uuidv4();
    
    const { method, url, traceId } = req;
    const now = Date.now();

    return next
      .handle()
      .pipe(
        tap(() => {
          const res = ctx.getResponse();
          res.setHeader('x-trace-id', traceId);
          this.logger.log(`[${traceId}] ${method} ${url} ${res.statusCode} - ${Date.now() - now}ms`);
        }),
      );
  }
}
