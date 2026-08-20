export type ErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_FILTER"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_ALREADY_EXISTS"
  | "INVALID_STATUS_TRANSITION";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;

  constructor(code: ErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function validationFailed(message: string): AppError {
  return new AppError("VALIDATION_FAILED", 400, message);
}

export function invalidFilter(message: string): AppError {
  return new AppError("INVALID_FILTER", 400, message);
}

export function notFound(message: string): AppError {
  return new AppError("RESOURCE_NOT_FOUND", 404, message);
}

export function alreadyExists(message: string): AppError {
  return new AppError("RESOURCE_ALREADY_EXISTS", 409, message);
}

export function invalidStatusTransition(message: string): AppError {
  return new AppError("INVALID_STATUS_TRANSITION", 409, message);
}
