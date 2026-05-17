// QAInterview — wizard Step 3 chat-style Q&A loop.
// Pulls one question at a time via GET /next-question, accepts the
// user's answer via POST /answer, then advances.  Skip button maps
// to POST /skip.  Auto-advances to the next wizard step when no more
// questions remain.

import { useEffect, useState } from 'react';
import { Send, SkipForward, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Question } from '../../services/filingApi';
import {
    getNextQuestion,
    submitAnswer,
    skipQuestion,
} from '../../services/filingApi';
import ChatBubble from './ChatBubble';
import ProgressBar from './ProgressBar';

interface QAInterviewProps {
    filingId: number;
    initialQuestions: Question[];   // from /start — used for "X of Y" math
    onAllAnswered: (estimatedLiability: number | null, completionPct: number) => void;
    onUpdate: (estimatedLiability: number | null, completionPct: number) => void;
}

interface HistoryEntry {
    question: Question;
    answer?: number | string;
    skipped?: boolean;
}

export default function QAInterview({
    filingId, initialQuestions, onAllAnswered, onUpdate,
}: QAInterviewProps) {
    const [currentQ, setCurrentQ] = useState<Question | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [draftValue, setDraftValue] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [remaining, setRemaining] = useState(initialQuestions.length);
    const totalAtStart = initialQuestions.length;

    useEffect(() => {
        loadNext();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadNext = async () => {
        setError(null);
        setLoading(true);
        const { data, error: apiError } = await getNextQuestion(filingId);
        setLoading(false);
        if (apiError) {
            setError(apiError);
            return;
        }
        if (!data || data.done || !data.next_question) {
            setDone(true);
            return;
        }
        setCurrentQ(data.next_question);
        setRemaining(data.remaining ?? 0);
        // Pre-fill with the AI's estimated_value when present.
        const est = data.next_question.estimated_value;
        setDraftValue(est !== null && est !== undefined ? String(est) : '');
    };

    const handleSubmit = async () => {
        if (!currentQ) return;
        setError(null);
        const inputType = currentQ.input_type || 'number';
        let value: number | string = draftValue;
        if (inputType === 'number') {
            const num = parseFloat(draftValue);
            if (isNaN(num)) {
                setError('Please enter a valid number.');
                return;
            }
            value = num;
        }
        setLoading(true);
        const { data, error: apiError } = await submitAnswer(filingId, currentQ.field_id, value);
        setLoading(false);
        if (apiError || !data) {
            setError(apiError || 'Failed to save answer.');
            return;
        }
        setHistory(h => [...h, { question: currentQ, answer: value }]);
        setDraftValue('');
        onUpdate(data.estimated_liability, data.completion_pct);

        if (!data.next_question) {
            setDone(true);
            onAllAnswered(data.estimated_liability, data.completion_pct);
            return;
        }
        setCurrentQ(data.next_question);
        setRemaining(data.remaining_questions);
        const est = data.next_question.estimated_value;
        setDraftValue(est !== null && est !== undefined ? String(est) : '');
    };

    const handleSkip = async () => {
        if (!currentQ) return;
        setError(null);
        setLoading(true);
        const { data, error: apiError } = await skipQuestion(filingId, currentQ.field_id);
        setLoading(false);
        if (apiError || !data) {
            setError(apiError || 'Failed to skip.');
            return;
        }
        setHistory(h => [...h, { question: currentQ, skipped: true }]);
        onUpdate(data.estimated_liability, data.completion_pct);
        if (!data.next_question) {
            setDone(true);
            onAllAnswered(data.estimated_liability, data.completion_pct);
            return;
        }
        setCurrentQ(data.next_question);
        setRemaining(data.remaining_questions);
        const est = data.next_question.estimated_value;
        setDraftValue(est !== null && est !== undefined ? String(est) : '');
    };

    const answeredCount = history.length;
    const progressPct = totalAtStart > 0
        ? Math.round((answeredCount / totalAtStart) * 100)
        : 100;

    if (done) {
        return (
            <div className="bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center animate-in fade-in duration-500">
                <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
                <h2 className="text-xl font-black text-gray-900 tracking-tight mb-1">
                    All Questions Answered
                </h2>
                <p className="text-sm text-gray-500 mb-6">
                    Moving on to review your full return.
                </p>
                <p className="text-xs text-gray-400">
                    {answeredCount} answered of {totalAtStart} ·{' '}
                    {history.filter(h => h.skipped).length} skipped
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Progress header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-black text-gray-700 uppercase tracking-widest">
                        Question {Math.min(answeredCount + 1, totalAtStart)} of {totalAtStart}
                    </p>
                    <span className="text-xs font-mono text-gray-500">
                        {remaining} remaining
                    </span>
                </div>
                <ProgressBar value={progressPct} label={`${progressPct}%`} />
            </div>

            {/* Chat history */}
            {history.length > 0 && (
                <div className="space-y-3">
                    {history.slice(-3).map((h, idx) => (
                        <div key={idx} className="space-y-2">
                            <ChatBubble role="ai">{h.question.question}</ChatBubble>
                            <ChatBubble role="user">
                                {h.skipped
                                    ? '— skipped —'
                                    : typeof h.answer === 'number'
                                        ? h.answer.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
                                        : String(h.answer)}
                            </ChatBubble>
                        </div>
                    ))}
                </div>
            )}

            {/* Current question */}
            {currentQ && (
                <div className="space-y-3">
                    <ChatBubble role="ai" hint={currentQ.hint}>
                        {currentQ.question}
                    </ChatBubble>

                    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3 ml-12">
                        <div className="flex items-center gap-2">
                            <input
                                type={currentQ.input_type === 'number' ? 'number' : 'text'}
                                value={draftValue}
                                onChange={e => setDraftValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                                placeholder={
                                    currentQ.estimated_value !== null && currentQ.estimated_value !== undefined
                                        ? `Suggested: ${currentQ.estimated_value}`
                                        : 'Enter your answer'
                                }
                                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-orange-400"
                                disabled={loading}
                                autoFocus
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={loading || !draftValue}
                                className="px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2"
                            >
                                <Send size={14} /> Send
                            </button>
                            <button
                                onClick={handleSkip}
                                disabled={loading}
                                className="px-4 py-3 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-700 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2"
                            >
                                <SkipForward size={14} /> Skip
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && !currentQ && (
                <div className="text-center text-sm text-gray-500 py-8">Loading next question…</div>
            )}

            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm font-bold text-rose-700 flex items-center gap-2">
                    <AlertCircle size={16} /> {error}
                </div>
            )}
        </div>
    );
}
