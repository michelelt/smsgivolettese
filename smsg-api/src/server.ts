import { serve } from '@hono/node-server';
import { app } from './app.js';

serve({ fetch: app.fetch, port: 3001 }, (i) => console.log(`api listening on :${i.port}`));
