let dismissTimer: ReturnType<typeof setTimeout> | null = null;

/** Top-of-screen toast: green background, white text, auto-dismiss 4s */
export function showToast(message: string): void {
  const id = 'app-global-share-toast';
  document.getElementById(id)?.remove();

  const el = document.createElement('div');
  el.id = id;
  el.setAttribute('role', 'status');
  el.textContent = message;
  el.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:99999',
    'background:#15803d',
    'color:#fff',
    'padding:12px 20px',
    'border-radius:8px',
    'font-size:14px',
    'font-weight:600',
    'max-width:min(520px,90vw)',
    'text-align:center',
    'box-shadow:0 4px 12px rgba(0,0,0,.18)',
  ].join(';');

  document.body.appendChild(el);

  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    el.remove();
    dismissTimer = null;
  }, 4000);
}
