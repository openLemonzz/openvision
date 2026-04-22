import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, missingServerConfig } from './config.js';
import { createApp } from './app.js';

const app = createApp({ missingConfig: missingServerConfig });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../client');

app.get('/env.js', (_req, res) => {
  res.type('application/javascript');
  res.send(
    `window.__ADMIN_CONFIG__ = ${JSON.stringify({
      VITE_SUPABASE_URL: config.supabaseUrl,
      VITE_SUPABASE_ANON_KEY: config.supabaseAnonKey,
      VITE_API_BASE_URL: '/api',
    })};`
  );
});

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(config.port, () => {
  console.log(`admin service listening on :${config.port}`);
});
