export type AppEnv = 'development' | 'staging' | 'production' | (string & {});

const raw = import.meta.env.VITE_APP_ENV;
export const appEnv: AppEnv =
  typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : 'development';

export const isStaging = appEnv === 'staging';
export const isProduction = appEnv === 'production';
