// StepIndicator — 5 numbered dots showing the wizard's current step.
// Active step = orange filled; completed = emerald check; pending = gray.

import { Check } from 'lucide-react';

interface StepIndicatorProps {
    current: number; // 1..5
    steps: { num: number; label: string }[];
}

export default function StepIndicator({ current, steps }: StepIndicatorProps) {
    return (
        <div className="flex items-center justify-between w-full max-w-3xl mx-auto">
            {steps.map((step, idx) => {
                const isComplete = step.num < current;
                const isActive = step.num === current;
                const isPending = step.num > current;
                const dotClass = isComplete
                    ? 'bg-emerald-500 text-white'
                    : isActive
                        ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                        : 'bg-gray-100 text-gray-400';
                const labelClass = isPending
                    ? 'text-gray-400'
                    : isActive
                        ? 'text-orange-700 font-black'
                        : 'text-emerald-700 font-bold';
                return (
                    <div key={step.num} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-2 min-w-[80px]">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black transition-all ${dotClass}`}>
                                {isComplete ? <Check size={18} /> : step.num}
                            </div>
                            <span className={`text-[10px] uppercase tracking-wider transition-colors ${labelClass}`}>
                                {step.label}
                            </span>
                        </div>
                        {idx < steps.length - 1 && (
                            <div className="flex-1 h-0.5 mx-1 -mt-6">
                                <div
                                    className={`h-full transition-all duration-500 ${
                                        isComplete ? 'bg-emerald-500' : 'bg-gray-200'
                                    }`}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
