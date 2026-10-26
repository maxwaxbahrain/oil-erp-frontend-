/** Lets Nexus Ask consume mic transcripts before the Phase-3 intent router. */
export type NexusTranscriptHook = (transcript: string) => Promise<boolean>;

let hook: NexusTranscriptHook | null = null;

export function setNexusTranscriptHook(fn: NexusTranscriptHook | null): void {
  hook = fn;
}

export async function tryNexusTranscriptHook(transcript: string): Promise<boolean> {
  if (!hook) return false;
  return hook(transcript);
}
