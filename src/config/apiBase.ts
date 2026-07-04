const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '') ||
  'http://localhost:8000/api';

export function getOilErpApiBase(): string {
  return String(API_BASE_URL).trim().replace(/\/$/, '');
}

/** Backend origin without the `/api` suffix (e.g. for `/ai/chat`, WebSockets). */
export function getOilErpApiHost(): string {
  const base = getOilErpApiBase();
  return base.replace(/\/api\/?$/i, '') || base;
}

export default API_BASE_URL;
