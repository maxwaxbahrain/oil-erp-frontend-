import { type InputHTMLAttributes, type ReactNode } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    icon?: ReactNode;
    error?: string | null;
}

export default function FormInput({ label, icon, error, ...props }: FormInputProps) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-redwood-text-muted uppercase tracking-widest flex items-center gap-2">
                {label} {props.required && <span className="text-redwood-brand">*</span>}
            </label>
            <div className="relative group">
                {icon && (
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-redwood-text-muted group-focus-within:text-redwood-brand transition-colors">
                        {icon}
                    </div>
                )}
                <input
                    {...props}
                    className={`w-full ${icon ? 'pl-10' : 'px-4'} pr-4 py-2.5 bg-redwood-bg-light border ${error ? 'border-redwood-brand' : 'border-redwood-border'} rounded-sm text-[13px] font-bold focus:bg-white focus:border-redwood-brand outline-none transition-all placeholder:text-redwood-text-muted/40 placeholder:font-medium`}
                />
            </div>
            {error && <p className="text-[9px] text-redwood-brand font-black uppercase tracking-widest mt-1">{error}</p>}
        </div>
    );
}
