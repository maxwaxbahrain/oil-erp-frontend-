import { useCallback, useEffect, useRef } from 'react';

type AutoGrowTextareaProps = Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    'rows'
> & {
    maxHeight?: number;
};

function measureTextarea(el: HTMLTextAreaElement, maxHeight: number) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
}

export default function AutoGrowTextarea({
    maxHeight = 240,
    value,
    className,
    onChange,
    ...rest
}: AutoGrowTextareaProps) {
    const ref = useRef<HTMLTextAreaElement>(null);

    const remeasure = useCallback(() => {
        if (ref.current) measureTextarea(ref.current, maxHeight);
    }, [maxHeight]);

    useEffect(() => {
        remeasure();
    }, [value, remeasure]);

    useEffect(() => {
        window.addEventListener('resize', remeasure);
        return () => window.removeEventListener('resize', remeasure);
    }, [remeasure]);

    return (
        <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={onChange}
            className={className}
            {...rest}
        />
    );
}
