import { describe, expect, it } from 'vitest';
import {
  ORBIT_DESIGN_H,
  ORBIT_DESIGN_W,
  ORBIT_GRID_MAX_WIDTH,
  orbitFitScale,
  shouldUseOrbitGrid,
} from './orbitScale';

/** Approximate orbit box after header + compact hero + tiles + live strip. */
function approxOrbitBox(viewportW: number, viewportH: number, zoom = 1) {
  const w = viewportW / zoom;
  const h = viewportH / zoom;
  const header = 64;
  const hero = 56;
  const tiles = 90;
  const strip = 44;
  const chrome = 24;
  const pageW = Math.max(0, w - 54); // icon rail
  const colGap = 28;
  const sideFrac = 0.85 + 0.85;
  const centreFrac = 1.5;
  const centreW = pageW * (centreFrac / (sideFrac + centreFrac)) - colGap;
  const centreH = h - header - hero - tiles - strip - chrome;
  return { boxW: Math.max(0, centreW), boxH: Math.max(0, centreH), pageW };
}

describe('orbitFitScale', () => {
  it('fits design inside box without exceeding 1', () => {
    expect(orbitFitScale(ORBIT_DESIGN_W, ORBIT_DESIGN_H)).toBe(1);
    expect(orbitFitScale(ORBIT_DESIGN_W * 2, ORBIT_DESIGN_H * 2)).toBe(1);
    expect(orbitFitScale(340, 270)).toBeCloseTo(0.5, 5);
    expect(orbitFitScale(0, 100)).toBe(0);
  });

  it('uses the tighter axis (min of w/h ratios)', () => {
    expect(orbitFitScale(680, 270)).toBeCloseTo(270 / ORBIT_DESIGN_H, 5);
    expect(orbitFitScale(340, 540)).toBeCloseTo(340 / ORBIT_DESIGN_W, 5);
  });

  it('keeps a usable scale at common laptop viewports (and 110% zoom)', () => {
    const sizes: Array<[number, number, number]> = [
      [1280, 650, 1],
      [1366, 768, 1],
      [1440, 900, 1],
      [1920, 1080, 1],
      [1280, 650, 1.1],
    ];
    for (const [vw, vh, zoom] of sizes) {
      const { boxW, boxH, pageW } = approxOrbitBox(vw, vh, zoom);
      expect(shouldUseOrbitGrid(pageW)).toBe(pageW < ORBIT_GRID_MAX_WIDTH);
      if (!shouldUseOrbitGrid(pageW)) {
        const s = orbitFitScale(boxW, boxH);
        expect(s).toBeGreaterThan(0.35);
        expect(s).toBeLessThanOrEqual(1);
        expect(ORBIT_DESIGN_W * s).toBeLessThanOrEqual(boxW + 0.5);
        expect(ORBIT_DESIGN_H * s).toBeLessThanOrEqual(boxH + 0.5);
      }
    }
  });

  it('grid only below 900px page width', () => {
    expect(shouldUseOrbitGrid(899)).toBe(true);
    expect(shouldUseOrbitGrid(900)).toBe(false);
    expect(shouldUseOrbitGrid(1280)).toBe(false);
  });
});
