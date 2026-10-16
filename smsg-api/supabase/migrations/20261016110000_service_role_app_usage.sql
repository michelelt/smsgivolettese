-- asService (ADR-002) runs as service_role and calls app.consume_rate_limit; it needs schema usage.
grant usage on schema app to service_role;
