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

export class TurnstileFailed extends DomainError {
  constructor(message = 'Verifica anti-spam non riuscita, riprova') {
    super(400, 'TURNSTILE_FAILED', message);
  }
}

// Stable RAISE EXCEPTION message codes from the DB -> [HTTP status, Italian message].
const PG_RAISE: Record<string, [ErrorStatus, string]> = {
  DRIVER_NOT_ELIGIBLE: [409, 'Il volontario non è idoneo alla guida (patente o autorizzazione)'],
  VEHICLE_NOT_SUITABLE: [409, 'Il mezzo non è adatto al trasporto richiesto'],
  DRIVER_HAS_FUTURE_TRANSPORTS: [409, 'Il volontario ha trasporti futuri assegnati'],
  LAST_SUPER_ADMIN: [409, 'Deve restare almeno un super amministratore attivo'],
  BOOKINGS_NOT_INVOICEABLE: [409, 'Alcune prenotazioni non sono fatturabili'],
  INVOICE_NOT_VOIDABLE: [409, 'La fattura non può essere annullata'],
  INVOICE_IMMUTABLE: [409, 'La fattura emessa non è modificabile'],
  COUNTER_BELOW_MAX: [409, 'Il contatore non può essere inferiore al numero più alto già emesso'],
  INVALID_DAY: [422, 'Giorno non valido'],
  SERVICE_NOT_BOOKABLE: [422, 'Il servizio non è prenotabile'],
  INVALID_INPUT: [400, 'Dati non validi'],
  ASSIGNMENT_NOT_FOUND: [404, 'Assegnazione non trovata'],
  TRANSPORT_NOT_FOUND: [404, 'Trasporto non trovato'],
  TRANSPORT_NOT_COMPLETABLE: [409, 'Il trasporto non può essere completato'],
};

/** Maps Postgres errors per architecture.md §Errors. */
export function fromPostgres(err: { code?: string; constraint_name?: string; message?: string }) {
  switch (err.code) {
    case '23P01':
      return new Conflict('Impegno sovrapposto', 'COMMITMENT_OVERLAP');
    case '23505':
      // TODO: map by constraint name (e.g. members_tax_code_key -> MEMBER_TAX_CODE_EXISTS)
      return new Conflict('Valore già esistente', 'DUPLICATE');
    case 'P0001': {
      // RAISE EXCEPTION message is the stable code
      const known = PG_RAISE[err.message ?? ''];
      if (!known) return new Conflict('Operazione non consentita');
      return new DomainError(known[0], err.message!, known[1]);
    }
    case '42501':
      return new Forbidden();
    default:
      return undefined;
  }
}
