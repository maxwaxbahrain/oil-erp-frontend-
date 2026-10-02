import { useEffect, useRef } from 'react';

function documentVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

export function useVisiblePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  options?: { enabled?: boolean; immediate?: boolean },
): void {
  const enabled = options?.enabled ?? true;
  const immediate = options?.immediate ?? true;
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const start = () => {
      stop();
      timer = setInterval(() => {
        void fnRef.current();
      }, intervalMs);
    };

    const onVisibilityChange = () => {
      if (!documentVisible()) {
        stop();
        return;
      }
      void fnRef.current();
      start();
    };

    if (documentVisible()) {
      if (immediate) {
        void fnRef.current();
      }
      start();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [enabled, immediate, intervalMs]);
}
