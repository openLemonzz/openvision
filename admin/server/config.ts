import 'dotenv/config';

function optionalEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export const config = {
  port: Number(process.env.PORT || 9902),
  webOrigin: optionalEnv('WEB_ORIGIN') || 'http://localhost:5173',
  databaseUrl: optionalEnv('DATABASE_URL'),
  supabaseUrl: optionalEnv('SUPABASE_URL'),
  supabaseAnonKey: optionalEnv('SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: optionalEnv('SUPABASE_SERVICE_ROLE_KEY'),
  configCryptKey: optionalEnv('CONFIG_CRYPT_KEY'),
};

export const missingServerConfig = [
  ['DATABASE_URL', config.databaseUrl],
  ['SUPABASE_URL', config.supabaseUrl],
  ['SUPABASE_ANON_KEY', config.supabaseAnonKey],
  ['SUPABASE_SERVICE_ROLE_KEY', config.supabaseServiceRoleKey],
  ['CONFIG_CRYPT_KEY', config.configCryptKey],
].filter(([, value]) => !value).map(([name]) => name);
