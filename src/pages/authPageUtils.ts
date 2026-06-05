export function authInputStyle(focused: boolean, hasValue: boolean) {
  return {
    background: focused ? 'var(--auth-input-bg-focus)' : 'var(--auth-input-bg)',
    border: `1px solid ${focused ? 'var(--auth-input-border-focus)' : 'var(--auth-input-border)'}`,
    borderRadius: '9px',
    padding: `12px 14px 12px ${hasValue ? '14px' : '40px'}`,
    fontSize: '15px',
    color: 'var(--auth-text)',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s, background-color 0.15s, padding 0.15s',
  } as const;
}

export function authIconStyle(hasValue: boolean) {
  return {
    position: 'absolute' as const,
    left: '13px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--auth-icon)',
    opacity: hasValue ? 0 : 1,
    transition: 'opacity 0.15s',
    pointerEvents: 'none' as const,
  };
}

export const authLabelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  color: 'var(--auth-text-label)',
} as const;

export const authPrimaryButtonStyle = (hover: boolean) => ({
  background: hover ? 'var(--auth-brand-hover)' : 'var(--auth-brand)',
  color: 'var(--auth-text)',
  border: 'none',
  borderRadius: '9px',
  padding: '13px',
  fontSize: '15px',
  fontWeight: 500,
  transition: 'background-color 0.15s',
});
