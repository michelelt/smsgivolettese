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
export class Unprocessable extends DomainError {
  constructor(message: string, code: string, details?: unknown) {
    super(422, code, message, details);
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

// Unique constraint name -> [code, Italian message].
const PG_UNIQUE: Record<string, [string, string]> = {
  members_tax_code_key: ['MEMBER_TAX_CODE_EXISTS', 'Esiste già un socio con questo codice fiscale'],
  membership_fees_member_id_year_key: [
    'FEE_ALREADY_PAID',
    "La quota di quell'anno è già registrata",
  ],
  shift_types_name_key: ['SHIFT_TYPE_EXISTS', 'Esiste già un tipo di turno con questo nome'],
  vehicles_plate_key: ['VEHICLE_PLATE_EXISTS', 'Esiste già un mezzo con questa targa'],
  posts_slug_key: ['POST_SLUG_EXISTS', 'Esiste già un articolo con questo indirizzo'],
  posts_from_proposal_id_key: ['PROPOSAL_ALREADY_DRAFTED', 'La proposta ha già una bozza'],
  shift_assignments_shift_id_volunteer_id_key: [
    'ALREADY_ASSIGNED',
    'Il volontario è già assegnato a questo turno',
  ],
};

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
  INVALID_INPUT: [400, 'Dati non validi'],
  ASSIGNMENT_NOT_FOUND: [404, 'Assegnazione non trovata'],
  TRANSPORT_NOT_FOUND: [404, 'Trasporto non trovato'],
  ASSIGNMENT_INVALID_TRANSITION: [409, "L'assegnazione non può più essere modificata"],
  TRANSPORT_INVALID_TRANSITION: [
    409,
    'Operazione non consentita nello stato attuale del trasporto',
  ],
  TRANSPORT_NOT_COMPLETABLE: [409, 'Il trasporto non può essere completato'],
  MEMBER_NOT_FOUND: [404, 'Socio non trovato'],
  MEMBER_NOT_ACTIVE: [422, 'Il socio non è attivo: riattivalo prima di prenotare'],
  VOID_REASON_REQUIRED: [400, "Indica il motivo dell'annullamento"],
  SLUG_FROZEN: [409, "L'indirizzo di un articolo già pubblicato non può cambiare"],
  CARD_NUMBER_IMMUTABLE: [409, 'Il numero di tessera non è modificabile'],
};

/** Maps Postgres errors per architecture.md §Errors. */
export function fromPostgres(err: { code?: string; constraint_name?: string; message?: string }) {
  switch (err.code) {
    case '23P01':
      return new Conflict('Impegno sovrapposto', 'COMMITMENT_OVERLAP');
    case '23505': {
      const u = PG_UNIQUE[err.constraint_name ?? ''];
      return u ? new Conflict(u[1], u[0]) : new Conflict('Valore già esistente', 'DUPLICATE');
    }
    case '23514':
      if (err.constraint_name === 'posts_event_date_chk')
        return new Unprocessable(
          "Indica la data dell'evento prima di pubblicare",
          'EVENT_DATE_REQUIRED',
        );
      return new ValidationError('Dati non validi');
    case '23503':
      return new ValidationError('Dati non validi');
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
