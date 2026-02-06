export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', public details?: any) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export function handleApiError(error: unknown): {
  message: string
  statusCode: number
  code?: string
  details?: any
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      details: error instanceof ValidationError ? error.details : undefined,
    }
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
    }
  }

  return {
    message: 'An unknown error occurred',
    statusCode: 500,
    code: 'UNKNOWN_ERROR',
  }
}
