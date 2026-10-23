/**
 * Prefer backend `detail` over axios generic "Request failed with status code …".
 * Handles string details (HTTP 400) and FastAPI validation arrays (often HTTP 422).
 */
export function extractUserManagementError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const axiosErr = err as {
    response?: { data?: { detail?: unknown } };
    message?: string;
  };
  const detail = axiosErr.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item: { msg?: string; loc?: (string | number)[] }) => {
        const field = item.loc?.[item.loc.length - 1];
        const msg = item.msg?.trim();
        if (!msg) return null;
        if (field != null && field !== 'body') return `${field}: ${msg}`;
        return msg;
      })
      .filter((s): s is string => Boolean(s));
    if (parts.length > 0) return parts.join('; ');
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }
  if (axiosErr.message && !axiosErr.response) {
    return axiosErr.message;
  }
  return fallback;
}
