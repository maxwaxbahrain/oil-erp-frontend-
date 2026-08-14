export const LOCKED_ROUTE_PREFIXES = [
  '/pulse/notes',
  '/credit',
  '/crm',
  '/amazon',
  '/tax',
  '/agents',
  '/news',
  '/marketing',
  '/voice',
  '/ai',
  '/reports/demand-forecast',
] as const;

export function isRouteLocked(pathname: string): boolean {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return LOCKED_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}
