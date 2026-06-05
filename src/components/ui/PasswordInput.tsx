import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  containerClassName?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className, style, containerClassName, disabled, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={containerClassName ?? 'relative w-full'}>
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={className}
        disabled={disabled}
        style={{
          ...style,
          paddingRight: style?.paddingRight ?? '2.75rem',
        }}
        {...props}
      />
      <button
        type="button"
        tabIndex={0}
        disabled={disabled}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-blue)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          color: 'var(--color-redwood-text-muted)',
          background: 'transparent',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
});

export default PasswordInput;
