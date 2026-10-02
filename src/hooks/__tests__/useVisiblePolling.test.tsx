import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from '../useVisiblePolling';
import { POLL_MS } from '../../pages/Logistics/VanTracking';
import { MESSAGE_POLL_MS } from '../../pages/Pulse/PulseDashboard';

const INTERVAL_MS = 1_000;

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  });
}

function Probe({
  enabled,
  immediate,
  intervalMs = INTERVAL_MS,
  onFire,
}: {
  enabled?: boolean;
  immediate?: boolean;
  intervalMs?: number;
  onFire: () => void;
}) {
  useVisiblePolling(onFire, intervalMs, { enabled, immediate });
  return null;
}

describe('useVisiblePolling', () => {
  let host: HTMLDivElement;
  let root: Root;
  let unmounted = false;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setVisibility('visible');
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    unmounted = false;
  });

  afterEach(() => {
    if (!unmounted) {
      act(() => {
        root.unmount();
      });
    }
    host.remove();
    Reflect.deleteProperty(document, 'visibilityState');
    vi.useRealTimers();
  });

  async function render(props: {
    enabled?: boolean;
    immediate?: boolean;
    intervalMs?: number;
    onFire: () => void;
  }) {
    await act(async () => {
      root.render(<Probe {...props} />);
    });
  }

  it('calls immediately while visible, then once per interval', async () => {
    const fn = vi.fn();
    await render({ onFire: fn });
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(fn).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not call when the tab is hidden on mount', async () => {
    setVisibility('hidden');
    const fn = vi.fn();
    await render({ onFire: fn });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('stops the interval when the tab becomes hidden', async () => {
    const fn = vi.fn();
    await render({ onFire: fn });
    expect(fn).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls immediately when the tab becomes visible and then resumes the interval', async () => {
    const fn = vi.fn();
    await render({ onFire: fn });

    setVisibility('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fn).toHaveBeenCalledTimes(1);

    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fn).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not call while disabled, and starts when enabled flips to true', async () => {
    const fn = vi.fn();
    await render({ enabled: false, onFire: fn });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      root.render(<Probe enabled onFire={fn} />);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS);
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('restarts the timer when intervalMs changes', async () => {
    const fn = vi.fn();
    await render({ onFire: fn, intervalMs: 1_000, immediate: false });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      root.render(<Probe intervalMs={3_000} immediate={false} onFire={fn} />);
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(fn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clears the timer and the visibility listener on unmount', async () => {
    const fn = vi.fn();
    await render({ onFire: fn });
    expect(fn).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    unmounted = true;

    await act(async () => {
      vi.advanceTimersByTime(INTERVAL_MS * 3);
    });
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('polling intervals', () => {
  it('uses the slower van and message intervals', () => {
    expect(POLL_MS).toBe(30_000);
    expect(MESSAGE_POLL_MS).toBe(10_000);
  });
});
