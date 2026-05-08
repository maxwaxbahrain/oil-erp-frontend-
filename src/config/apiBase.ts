export function getOilErpApiBase(): string {
  const viteHost = String(import.meta.env.VITE_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (viteHost) {
    return `${viteHost}/api`;
  }

  const fromEnv = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }

  return 'http://localhost:8000/api';
}
