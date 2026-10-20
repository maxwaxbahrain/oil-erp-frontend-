import { afterEach, describe, expect, it, vi } from 'vitest';

describe('postLoginHomePath', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('staging admin lands on Nexus; others stay on dashboard', async () => {
    vi.stubEnv('VITE_APP_ENV', 'staging');
    const { postLoginHomePath } = await import('./stagingHome');
    expect(postLoginHomePath('admin')).toBe('/agent/nexus');
    expect(postLoginHomePath('ADMIN')).toBe('/agent/nexus');
    expect(postLoginHomePath('manager')).toBe('/dashboard');
    expect(postLoginHomePath('accountant')).toBe('/dashboard');
    expect(postLoginHomePath(null)).toBe('/dashboard');
  });

  it('non-staging never redirects to Nexus', async () => {
    vi.stubEnv('VITE_APP_ENV', 'production');
    const { postLoginHomePath } = await import('./stagingHome');
    expect(postLoginHomePath('admin')).toBe('/dashboard');
  });
});
