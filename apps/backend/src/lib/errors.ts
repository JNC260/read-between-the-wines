// Services throw these; the error-handling middleware turns them into
// { error: { code, message, details? } } responses with the matching status.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", details?: unknown) {
    super(400, "BAD_REQUEST", message, details);
  }
}

// 401: we don't know who you are.
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
    super(401, code, message);
  }
}

// 403: we know who you are, and you can't do this. Pass a specific code when
// the frontend needs to react to the reason (e.g. ACCOUNT_INACTIVE).
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code = "FORBIDDEN") {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, "CONFLICT", message);
  }
}

// 502: a service we depend on (like Open Library) failed or sent something
// we couldn't read. Not the client's fault, but not our bug either.
export class BadGatewayError extends AppError {
  constructor(message = "An outside service is unavailable") {
    super(502, "BAD_GATEWAY", message);
  }
}
