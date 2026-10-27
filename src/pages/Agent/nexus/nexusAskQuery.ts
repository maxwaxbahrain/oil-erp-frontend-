import type { AskAnswer } from './nexusAskNav';
import { tryAskFastPath, type AskFastContext } from './nexusAskFastPath';
import type { ChatTurn } from './nexusVoiceCapture';

export const ASK_CHAT_TIMEOUT_MS = 20_000;
export const ASK_SLOW_HINT_MS = 8_000;
export const ASK_TIMEOUT_MESSAGE = 'That took too long — try again';

export type AskQueryResult = {
  answer: AskAnswer;
  fromFastPath: boolean;
  timedOut: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((v) => {
        window.clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(t);
        reject(e);
      });
  });
}

export async function queryNexusAsk(
  message: string,
  ctx: AskFastContext,
  chat: (msg: string, history?: ChatTurn[]) => Promise<AskAnswer>,
  onSlowHint?: () => void,
  history?: ChatTurn[],
): Promise<AskQueryResult> {
  const fast = tryAskFastPath(message, ctx);
  if (fast) {
    return {
      fromFastPath: true,
      timedOut: false,
      answer: {
        headline: fast.headline,
        detail: fast.detail,
        buttons: fast.buttons,
      },
    };
  }

  let slowFired = false;
  const slowTimer = window.setTimeout(() => {
    slowFired = true;
    onSlowHint?.();
  }, ASK_SLOW_HINT_MS);

  try {
    const answer = await withTimeout(chat(message, history), ASK_CHAT_TIMEOUT_MS);
    return { answer, fromFastPath: false, timedOut: false };
  } catch (e) {
    if ((e as Error)?.message === 'timeout' || slowFired) {
      return {
        fromFastPath: false,
        timedOut: true,
        answer: { headline: ASK_TIMEOUT_MESSAGE, detail: '', buttons: [] },
      };
    }
    throw e;
  } finally {
    window.clearTimeout(slowTimer);
  }
}
