// utils/HttpError.ts
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static notFound(message = 'Not found') {
    return new HttpError(404, message, 'NOT_FOUND');
  }

  static badRequest(message = 'Bad request') {
    return new HttpError(400, message, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Unauthorized') {
    return new HttpError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new HttpError(403, message, 'FORBIDDEN');
  }

  static internal(message = 'Internal server error') {
    return new HttpError(500, message, 'INTERNAL_ERROR');
  }
}

export function handleHttpError(error: unknown): { statusCode: number; message: string } {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, message: error.message };
  }
  
  if (error instanceof Error) {
    return { statusCode: 500, message: 'Internal server error' };
  }
  
  return { statusCode: 500, message: 'Internal server error' };
} 