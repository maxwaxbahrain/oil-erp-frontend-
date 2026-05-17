// FilingWizard — the 5-step flow.
//
// One component with React state for currentStep (1..5).  URL stays
// /tax/filing/wizard/:filingId throughout — refresh-safe via session
// loading from the backend.
//
// Step 1: Start         (handled BEFORE this component, by FilingWizardStart
//                        which calls POST /start then navigates here on step 2)
// Step 2: ERP Review    — ERPDataReview
// Step 3: Q&A           — QAInterview
// Step 4: Form Review   — FormReview
// Step 5: Submit        — SubmitStep
//
// On mount, GET /session/{id} to load full state and jump to the right
// step based on what's already been done.

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import type {
    MappedField,
    DeductionOpportunity,
    Question,
    FilingStatus,
} from '../services/filingApi';
import {
    getSession,
    getPreview,
} from '../services/filingApi';

import StepIndicator from './components/StepIndicator';
import ERPDataReview from './components/ERPDataReview';
import QAInterview from './components/QAInterview';
import FormReview from './components/FormReview';
import SubmitStep from './components/SubmitStep';


const STEPS = [
    { num: 1, label: 'Setup' },
    { num: 2, label: 'ERP Data' },
    { num: 3, label: 'Q&A' },
    { num: 4, label: 'Review' },
    { num: 5, label: 'Submit' },
];


export default function FilingWizard() {
    const navigate = useNavigate();
    const params = useParams<{ filingId: string }>();
    const filingId = Number(params.filingId);

    const [currentStep, setCurrentStep] = useState(2);  // jump straight past Start
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Session state.
    const [formType, setFormType] = useState<string>('1120');
    const [taxYear, setTaxYear] = useState<number>(2024);
    const [entityEin, setEntityEin] = useState<string>('');
    const [status, setStatus] = useState<FilingStatus>('in_progress');
    const [mappedFields, setMappedFields] = useState<Record<string, MappedField>>({});
    const [completionPct, setCompletionPct] = useState(0);
    const [estimatedLiability, setEstimatedLiability] = useState<number | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [deductionOpps, setDeductionOpps] = useState<DeductionOpportunity[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);

    useEffect(() => {
        if (!filingId || isNaN(filingId)) {
            setError('Invalid filing ID.');
            setLoading(false);
            return;
        }
        loadSession();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filingId]);

    const loadSession = async () => {
        setLoading(true);
        setError(null);
        const { data, error: apiError } = await getSession(filingId);
        if (apiError || !data) {
            setError(apiError || 'Failed to load filing session.');
            setLoading(false);
            return;
        }
        setFormType(data.form_type);
        setTaxYear(data.tax_year);
        setStatus(data.status);
        setMappedFields(data.mapped_fields);
        setCompletionPct(data.completion_pct);
        setEstimatedLiability(data.estimated_liability);
        setQuestions(data.questions || []);
        setWarnings(data.ai_warnings || []);
        // EIN isn't directly in the session response — pull from user_answers
        // or default empty.  Cosmetic for the Submit screen.
        setEntityEin('');

        // Also pull deduction opportunities via /preview (they're not in
        // the session response; they're recomputed per analyze).
        const preview = await getPreview(filingId);
        if (preview.data) {
            setDeductionOpps(preview.data.deduction_opportunities);
            // Reuse preview warnings (richer than the session's ai_warnings).
            if (preview.data.warnings.length > 0) {
                setWarnings(preview.data.warnings);
            }
        }

        // Auto-jump to the right step based on filing state.
        if (data.status === 'ready' || data.status === 'submitted' || data.status === 'accepted') {
            setCurrentStep(5);
        } else if ((data.questions || []).length === 0 && data.completion_pct >= 50) {
            setCurrentStep(4);
        } else {
            setCurrentStep(2);
        }
        setLoading(false);
    };

    // Step transitions.
    const goToStep = (n: number) => setCurrentStep(Math.max(1, Math.min(5, n)));

    // ─── Loading / error views ─────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex items-center gap-3 text-gray-500">
                    <Loader2 size={20} className="animate-spin" />
                    <span className="text-sm font-bold">Loading filing session…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto pt-10">
                <button onClick={() => navigate('/tax/filing')} className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-4">
                    <ArrowLeft size={14} /> Back to filings
                </button>
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-start gap-3">
                    <AlertCircle size={20} className="text-rose-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h2 className="text-sm font-black text-rose-900 uppercase mb-1">
                            Could not load filing
                        </h2>
                        <p className="text-sm text-rose-700">{error}</p>
                        <button
                            onClick={loadSession}
                            className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-10 animate-in fade-in duration-300">
            {/* Header */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                <button
                    onClick={() => navigate('/tax/filing')}
                    className="flex items-center gap-1 text-xs font-black text-gray-400 hover:text-gray-700 mb-3"
                >
                    <ArrowLeft size={14} /> Back to filings
                </button>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
                    <div>
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                            Form {formType} — Tax Year {taxYear}
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 font-mono">
                            Filing ID #{filingId} · Status: <span className="font-black uppercase">{status}</span>
                        </p>
                    </div>
                </div>
                <StepIndicator current={currentStep} steps={STEPS} />
            </div>

            {/* Active step */}
            {currentStep === 2 && (
                <ERPDataReview
                    filingId={filingId}
                    mappedFields={mappedFields}
                    completionPct={completionPct}
                    estimatedLiability={estimatedLiability}
                    onContinue={() => goToStep(3)}
                    onUpdate={(mf, pct, est) => {
                        setMappedFields(mf);
                        setCompletionPct(pct);
                        setEstimatedLiability(est);
                    }}
                />
            )}

            {currentStep === 3 && (
                <QAInterview
                    filingId={filingId}
                    initialQuestions={questions}
                    onAllAnswered={(est, pct) => {
                        setEstimatedLiability(est);
                        setCompletionPct(pct);
                        // Reload session to get fresh mapped_fields + deductions
                        // before stepping into Review.
                        loadSession().then(() => goToStep(4));
                    }}
                    onUpdate={(est, pct) => {
                        setEstimatedLiability(est);
                        setCompletionPct(pct);
                    }}
                />
            )}

            {currentStep === 4 && (
                <FormReview
                    filingId={filingId}
                    mappedFields={mappedFields}
                    deductionOpportunities={deductionOpps}
                    estimatedLiability={estimatedLiability}
                    onContinue={() => goToStep(5)}
                    onUpdate={(mf, est) => {
                        setMappedFields(mf);
                        setEstimatedLiability(est);
                    }}
                />
            )}

            {currentStep === 5 && (
                <SubmitStep
                    filingId={filingId}
                    formType={formType}
                    taxYear={taxYear}
                    entityEin={entityEin || '—'}
                    estimatedLiability={estimatedLiability}
                    warnings={warnings}
                />
            )}

            {/* Back / step nav */}
            {currentStep > 2 && currentStep < 5 && (
                <div className="flex justify-start">
                    <button
                        onClick={() => goToStep(currentStep - 1)}
                        className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wide"
                    >
                        ← Back
                    </button>
                </div>
            )}
        </div>
    );
}
