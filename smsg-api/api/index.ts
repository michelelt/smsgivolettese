import { handle } from 'hono/vercel';
import { app } from '../src/app.js';

// hono/vercel is deprecated in favour of @hono/vercel (hono v5); its handler is a plain fetch wrapper that works on the Node runtime.
const handler = handle(app);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
