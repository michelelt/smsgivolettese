-- ADR-003: the API (Hono) is the only door to data. PostgREST needs at least one exposed schema (an empty
-- list falls back to `public`), so expose an empty one: no tables, no functions, no grants.
create schema if not exists api;
