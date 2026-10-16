import * as repo from './public.repo.js';
import { ServicesResponse, SiteSettings } from './public.schemas.js';

// Strict parse fails closed: a ZodError reaches app.onError, which logs only the error name and returns 500.
export const listServices = async (requestId?: string) =>
  ServicesResponse.parse({ items: await repo.listServices(requestId) }).items;
export const getSiteSettings = async (requestId?: string) =>
  SiteSettings.parse(await repo.getSiteSettings(requestId));
