import { writeFileSync } from 'node:fs';
import { app } from '../src/app.js';

const res = await app.request('/openapi.json');
writeFileSync(
  new URL('../openapi.json', import.meta.url),
  JSON.stringify(await res.json(), null, 2) + '\n',
);
