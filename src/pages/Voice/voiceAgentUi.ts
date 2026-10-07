import { isProduction } from '../../config/appEnv';

/** AI agent panel is staging/dev only. Production Voice dashboard stays unchanged. */
export function shouldShowVoiceAgentPanel(): boolean {
    return !isProduction;
}
