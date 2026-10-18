-- ADR-066/067: GDPR exports are audited. Own file: a new enum value cannot be used in the transaction that adds it.
alter type public.audit_action add value if not exists 'export';
