/**
 * Single source of truth for the night → sunrise → morning light curve, shared by the room lighting
 * and the window so both transition together.
 *
 * 12:00 AM deep night · 2:00 AM late night (the sky begins to thin) · 4:30 AM the sun starts rising
 * · 5:00–6:00 AM golden sunrise · full morning light by 8:00 AM.
 */
const SUNRISE_START = 270; // 4:30 AM — first light on the horizon
const GOLDEN_START = 300; // 5:00 AM
const GOLDEN_END = 360; // 6:00 AM
const GOLDEN_GONE = 450; // 7:30 AM — the warm cast has faded out
const FULL_LIGHT = 480; // 8:00 AM
const DUSK_START = 1140; // 7:00 PM
const NIGHT_AGAIN = 1260; // 9:00 PM

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export type DayCycle = {
  /** 0 = deep night, 1 = full daylight. Drives ambient/directional intensity and the sky colour. */
  daylight: number;
  /** 0–1 warm sunrise cast, peaking across the 5:00–6:00 AM golden hour. */
  golden: number;
  /** 0–1 travel of the sun disc across the window, from the 4:30 AM horizon upward. */
  sunProgress: number;
};

export function dayCycle(minuteOfDay: number): DayCycle {
  const rise = smoothstep(SUNRISE_START, FULL_LIGHT, minuteOfDay);
  const set = 1 - smoothstep(DUSK_START, NIGHT_AGAIN, minuteOfDay);
  // The 2 AM sky is a shade less black than midnight, so the small hours still read as passing time.
  const preDawn = smoothstep(120, SUNRISE_START, minuteOfDay) * 0.08;
  const golden = Math.min(smoothstep(SUNRISE_START, GOLDEN_START, minuteOfDay), 1 - smoothstep(GOLDEN_END, GOLDEN_GONE, minuteOfDay));
  return {
    daylight: Math.min(Math.max(rise, preDawn), set),
    golden: Math.max(0, golden) * set,
    sunProgress: rise,
  };
}
