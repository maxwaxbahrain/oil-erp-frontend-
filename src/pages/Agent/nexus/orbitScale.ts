/** Fixed design size for the orbit ellipse + cards (never shrink layout — scale instead). */
export const ORBIT_DESIGN_W = 680;
export const ORBIT_DESIGN_H = 540;

/** Narrow page: stacked module grid, orb hidden. */
export const ORBIT_GRID_MAX_WIDTH = 900;

/**
 * Uniform scale so the design-size orbit fits inside its box without clipping.
 * Never exceeds 1 (do not upscale past design).
 */
export function orbitFitScale(
  boxW: number,
  boxH: number,
  designW: number = ORBIT_DESIGN_W,
  designH: number = ORBIT_DESIGN_H,
): number {
  if (boxW <= 0 || boxH <= 0 || designW <= 0 || designH <= 0) return 0;
  return Math.min(1, boxW / designW, boxH / designH);
}

/** True when the page/root is narrow enough for the stacked card grid. */
export function shouldUseOrbitGrid(pageWidth: number): boolean {
  return pageWidth > 0 && pageWidth < ORBIT_GRID_MAX_WIDTH;
}
