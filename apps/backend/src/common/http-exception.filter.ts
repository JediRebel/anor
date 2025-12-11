// apps/backend/src/common/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response & { status?: (code: number) => any }>();
    const request = ctx.getRequest<Request>();

    // 默认值：内部错误
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = (res as any).message ?? res;
    }

    const errorResponse = {
      success: false,
      statusCode: status,
      path: request.url,
      method: (request as any).method,
      message,
      timestamp: new Date().toISOString(),
    };

    this.logger.error(
      `${errorResponse.method} ${errorResponse.path} ${status} - ${JSON.stringify(
        message,
      )}`,
      (exception as any).stack,
    );

    (response as any).status(status).json(errorResponse);
  }
}