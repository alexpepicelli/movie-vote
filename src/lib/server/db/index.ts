import { DATABASE_URL } from '$app/env/private';
import { openDatabase } from './client';

export const db = openDatabase(DATABASE_URL);
export * as schema from './schema';
