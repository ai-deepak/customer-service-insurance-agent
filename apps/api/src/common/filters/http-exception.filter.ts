import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';

@Catch()
export class HttpErrorFilter implements ExceptionFilter {
	handleValidation(exception: BadRequestException, requestId: string) {
		const response: any = exception.getResponse();
		const details = typeof response === 'object' ? response : { response };
		return {
			statusCode: HttpStatus.BAD_REQUEST,
			code: 'VALIDATION_ERROR',
			message: 'Validation failed',
			details,
			requestId,
			timestamp: new Date().toISOString(),
		};
	}

	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse();
		const request = ctx.getRequest();
		const requestId: string = request.headers['x-request-id'] ?? '';

		if (exception instanceof BadRequestException) {
			return response.status(HttpStatus.BAD_REQUEST).json(this.handleValidation(exception, requestId));
		}

		if (exception instanceof UnauthorizedException) {
			return response.status(HttpStatus.UNAUTHORIZED).json({
				statusCode: HttpStatus.UNAUTHORIZED,
				code: 'UNAUTHORIZED',
				message: exception.message,
				requestId,
				timestamp: new Date().toISOString(),
			});
		}

		if (exception instanceof NotFoundException) {
			return response.status(HttpStatus.NOT_FOUND).json({
				statusCode: HttpStatus.NOT_FOUND,
				code: 'NOT_FOUND',
				message: exception.message,
				requestId,
				timestamp: new Date().toISOString(),
			});
		}

		if (exception instanceof HttpException) {
			return response.status(exception.getStatus()).json({
				statusCode: exception.getStatus(),
				code: 'HTTP_ERROR',
				message: exception.message,
				requestId,
				timestamp: new Date().toISOString(),
			});
		}

		return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			code: 'INTERNAL_ERROR',
			message: 'Unexpected server error',
			requestId,
			timestamp: new Date().toISOString(),
		});
	}
}
