// VOICE COMMAND PROCESSOR — takes a transcript, asks Claude what to
// do, executes the action.
//
// Flow:
//   transcript ──▶ voiceAssistantService.sendVoiceCommandToClaude()
//              ──▶ { action, path?, data?, message }
//              ──▶ executeAction() does the navigation / search / etc.
//              ──▶ returns { message } for the UI / TTS.
//
// Supported actions (must match the service's VoiceAction union):
//   NAVIGATE        → navigate to a path
//   CREATE_INVOICE  → /sales/invoices/new + state.voicePrefill
//   SEARCH          → navigate to a path (typically with ?search=...)
//   ANSWER          → no navigation; just speak the message
//
// ISOLATION: imports only the sibling service file in this folder's
// service module, plus the react-router-dom NavigateFunction type.
// Does NOT touch any existing component, store, or service.
// ============================================

import type { NavigateFunction } from 'react-router-dom';
import {
    sendVoiceCommandToClaude,
    type VoiceAction,
} from '../../services/voiceAssistantService';

export interface ProcessResult {
    message: string;
}

export async function processVoiceCommand(
    transcript: string,
    navigate: NavigateFunction
): Promise<ProcessResult> {
    const text = (transcript || '').trim();
    if (!text) {
        return { message: 'I did not catch that.' };
    }

    let action: VoiceAction;
    try {
        action = await sendVoiceCommandToClaude(text);
    } catch (e: unknown) {
        // Re-throw so the caller (VoiceAssistant.tsx) can surface a
        // popup error with the underlying message.  We deliberately
        // don't swallow it here — a service-level failure is a real
        // problem the user should see.
        throw e;
    }

    return executeAction(action, navigate);
}

function executeAction(
    action: VoiceAction,
    navigate: NavigateFunction
): ProcessResult {
    const fallbackMsg = action.message?.trim() || 'Done.';

    switch (action.action) {
        case 'NAVIGATE': {
            const path = sanitizePath(action.path);
            if (!path) {
                return {
                    message:
                        action.message?.trim() ||
                        "I couldn't figure out which page to open.",
                };
            }
            navigate(path);
            return { message: fallbackMsg };
        }

        case 'CREATE_INVOICE': {
            // The invoice-create form in the existing app lives at
            // /sales/invoices/new — confirmed from routes.tsx during
            // Phase 1.  We pass any prefill data via React Router's
            // navigation state under `voicePrefill` so the form can
            // opt in to read it without breaking if it doesn't.
            const prefill = isPlainObject(action.data) ? action.data : {};
            navigate('/sales/invoices/new', {
                state: { voicePrefill: prefill },
            });
            return { message: fallbackMsg };
        }

        case 'SEARCH': {
            // SEARCH is a NAVIGATE with a query string — same shape.
            // The system prompt tells Claude which path/query to use
            // for each kind of search (customers/invoices/etc.), so we
            // just navigate to whatever it returns.
            const path = sanitizePath(action.path);
            if (!path) {
                return {
                    message:
                        action.message?.trim() ||
                        "I couldn't figure out what to search for.",
                };
            }
            navigate(path);
            return { message: fallbackMsg };
        }

        case 'ANSWER': {
            // No navigation — assistant just speaks the reply.
            return { message: fallbackMsg };
        }

        default: {
            // Defensive — service layer already validates the action
            // shape, but if a future Claude response sneaks past it,
            // fail gracefully instead of throwing.
            return {
                message:
                    action.message?.trim() ||
                    "I didn't understand that command. Try again.",
            };
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────

/** Only accept same-origin relative paths.  Blocks `javascript:`,
 *  absolute URLs, protocol-relative URLs, and empty strings so a
 *  hallucinated path from Claude can't navigate anywhere weird. */
function sanitizePath(p: unknown): string | null {
    if (typeof p !== 'string') return null;
    const trimmed = p.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('/')) return null;
    if (trimmed.startsWith('//')) return null; // protocol-relative
    return trimmed;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
