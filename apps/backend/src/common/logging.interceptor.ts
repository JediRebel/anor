// apps/backend/src/common/logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id: string } }>();

    const { method, url } = request;
    const userId = request.user?.id ?? 'anonymous';

    return next.handle().pipe(
      tap(() => {
        const response = http.getResponse<Response & { statusCode?: number }>();
        const statusCode = (response as any).statusCode ?? 0;
        const cost = Date.now() - now;

        this.logger.log(
          `${method} ${url} ${statusCode} ${cost}ms user=${userId}`,
        );
      }),
    );
  }
}