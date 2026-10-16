export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500;

export class DomainError extends Error {
  constructor(
    public status: ErrorStatus,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Dati non validi', details?: unknown, code = 'VALIDATION_ERROR') {
    super(400, code, message, details);
  }
}
export class Unauthorized extends DomainError {
  constructor(message = 'Accesso non autorizzato') {
    super(401, 'UNAUTHORIZED', message);
  }
}
export class Forbidden extends DomainError {
  constructor(message = 'Operazione non consentita') {
    super(403, 'FORBIDDEN', message);
  }
}
export class NotFound extends DomainError {
  constructor(message = 'Risorsa non trovata') {
    super(404, 'NOT_FOUND', message);
  }
}
export class Conflict extends DomainError {
  constructor(message = 'Conflitto con lo stato attuale', code = 'CONFLICT', details?: unknown) {
    super(409, code, message, details);
  }
}
export class RateLimited extends DomainError {
  constructor(message = 'Troppe richieste, riprova più tardi') {
    super(429, 'RATE_LIMITED', message);
  }
}

/** Placeholder: maps Postgres errors per architecture.md §Errors. Messages refined with each module. */
export function fromPostgres(err: { code?: string; constraint_name?: string; message?: string }) {
  switch (err.code) {
    case '23P01':
      return new Conflict('Impegno sovrapposto', 'COMMITMENT_OVERLAP');
    case '23505':
      // TODO: map by constraint name (e.g. members_tax_code_key -> MEMBER_TAX_CODE_EXISTS)
      return new Conflict('Valore già esistente', 'DUPLICATE');
    case 'P0001':
      // RAISE EXCEPTION message is the stable code (DRIVER_NOT_ELIGIBLE, LAST_SUPER_ADMIN, ...)
      return new Conflict('Operazione non consentita', err.message ?? 'CONFLICT');
    case '42501':
      return new Forbidden();
    default:
      return undefined;
  }
}
