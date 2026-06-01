export const ADVISOR_URL = import.meta.env.VITE_ADVISOR_URL ?? "https://advisor.soltol.com";

export const ADVISOR_WIDTH_KEY = "soltol-advisor-width";
export const ADVISOR_SIDE_KEY = "soltol-advisor-side";

export const ADVISOR_DEFAULT_WIDTH = 480;
export const ADVISOR_MIN_WIDTH = 360;

export type AdvisorSide = "left" | "right";

export function getAdvisorMaxWidth(viewportWidth = window.innerWidth): number {
  return Math.floor(viewportWidth * 0.8);
}

export function clampAdvisorWidth(width: number, viewportWidth = window.innerWidth): number {
  return Math.min(getAdvisorMaxWidth(viewportWidth), Math.max(ADVISOR_MIN_WIDTH, width));
}

export function loadAdvisorWidth(): number {
  try {
    const stored = localStorage.getItem(ADVISOR_WIDTH_KEY);
    if (stored) {
      const parsed = Number.parseInt(stored, 10);
      if (!Number.isNaN(parsed)) {
        return clampAdvisorWidth(parsed);
      }
    }
  } catch {
    /* ignore */
  }
  return ADVISOR_DEFAULT_WIDTH;
}

export function loadAdvisorSide(): AdvisorSide {
  try {
    const stored = localStorage.getItem(ADVISOR_SIDE_KEY);
    if (stored === "left" || stored === "right") return stored;
  } catch {
    /* ignore */
  }
  return "right";
}

export function saveAdvisorWidth(width: number): void {
  try {
    localStorage.setItem(ADVISOR_WIDTH_KEY, String(width));
  } catch {
    /* ignore */
  }
}

export function saveAdvisorSide(side: AdvisorSide): void {
  try {
    localStorage.setItem(ADVISOR_SIDE_KEY, side);
  } catch {
    /* ignore */
  }
}
