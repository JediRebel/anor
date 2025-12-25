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
    const response = ctx.getResponse<
      Response & { status?: (code: number) => any }
    >();
    const request = ctx.getRequest<Request>();

    // 默认值：内部错误
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // 统一从 HttpException.getResponse() 中取 message 字段，没有就用整个 res
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

    const logText = `${errorResponse.method} ${errorResponse.path} ${status} - ${JSON.stringify(
      message,
    )}`;

    // 区分 4xx / 5xx 的日志级别：
    // - 4xx：业务 / 参数错误，用 warn
    // - 5xx：系统异常，用 error，并带上 stack
    if (exception instanceof HttpException) {
      if (status >= 500) {
        this.logger.error(logText, (exception as any).stack);
      } else {
        this.logger.warn(logText);
      }
    } else {
      // 非 HttpException，一律视为系统级错误
      this.logger.error(logText, (exception as any)?.stack);
    }

    (response as any).status(status).json(errorResponse);
  }
}
