// The app's one database. Tests create their own with createDb().
import { createDb } from './schema.ts';

export const db = createDb();
