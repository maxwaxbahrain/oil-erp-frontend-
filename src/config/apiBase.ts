const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '') ||
  'http://localhost:8000/api';

export function getOilErpApiBase(): string {
  return String(API_BASE_URL).trim().replace(/\/$/, '');
}

export default API_BASE_URL;
