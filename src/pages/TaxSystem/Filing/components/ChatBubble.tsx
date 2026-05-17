// ChatBubble — two flavours: 'ai' (gray, left-aligned, robot avatar)
// and 'user' (orange, right-aligned).  Used by QAInterview.

import { Bot, User } from 'lucide-react';

interface ChatBubbleProps {
    role: 'ai' | 'user';
    children: React.ReactNode;
    hint?: string;
}

export default function ChatBubble({ role, children, hint }: ChatBubbleProps) {
    if (role === 'ai') {
        return (
            <div className="flex items-start gap-3 max-w-[85%] animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot size={18} className="text-orange-400" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-md px-4 py-3">
                    <p className="text-sm text-gray-800 leading-relaxed">{children}</p>
                    {hint && (
                        <p className="text-xs text-gray-500 italic mt-1.5 leading-relaxed">
                            {hint}
                        </p>
                    )}
                </div>
            </div>
        );
    }
    // user — right-aligned
    return (
        <div className="flex items-start gap-3 max-w-[85%] ml-auto justify-end animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="bg-orange-500 rounded-2xl rounded-tr-md px-4 py-3">
                <p className="text-sm text-white font-mono font-bold">{children}</p>
            </div>
            <div className="w-9 h-9 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={18} className="text-orange-700" />
            </div>
        </div>
    );
}
