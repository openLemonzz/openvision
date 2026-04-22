import { Pool } from 'pg';
import { config } from './config.js';

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
    })
  : null;
