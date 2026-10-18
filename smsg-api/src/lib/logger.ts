import { env } from '../config/env.js';

const levels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof levels;

// Callers must pass only non-PII fields (ids, route, status), never bodies or tokens.
export function log(level: Level, msg: string, fields: Record<string, unknown> = {}) {
  if (levels[level] < levels[env.LOG_LEVEL]) return;
  console[level === 'debug' ? 'log' : level](JSON.stringify({ level, msg, ...fields }));
}
