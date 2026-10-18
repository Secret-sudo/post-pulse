// Validation for the breakout / viral multipliers (SPEC §6.2: relative to the
// personal median, configurable).
export const BREAKOUT_RANGE = { min: 1.5, max: 20 } as const;
export const VIRAL_RANGE = { min: 2, max: 100 } as const;

export const VIRAL_IMPRESSIONS_RANGE = { min: 100, max: 10_000_000 } as const;

export type ThresholdError =
  'breakout-range' | 'viral-range' | 'viral-not-above' | 'not-a-number' | 'impressions-range';

/** `viralImpressions` is checked only when the fixed-number mode is chosen. */
export function validateThresholds(
  breakout: number,
  viral: number,
  viralImpressions?: number,
): ThresholdError[] {
  const errors: ThresholdError[] = [];
  if (viralImpressions !== undefined) {
    if (!Number.isFinite(breakout) || !Number.isFinite(viralImpressions)) return ['not-a-number'];
    if (breakout < BREAKOUT_RANGE.min || breakout > BREAKOUT_RANGE.max)
      errors.push('breakout-range');
    if (
      !Number.isInteger(viralImpressions) ||
      viralImpressions < VIRAL_IMPRESSIONS_RANGE.min ||
      viralImpressions > VIRAL_IMPRESSIONS_RANGE.max
    )
      errors.push('impressions-range');
    return errors;
  }
  if (!Number.isFinite(breakout) || !Number.isFinite(viral)) return ['not-a-number'];
  if (breakout < BREAKOUT_RANGE.min || breakout > BREAKOUT_RANGE.max) errors.push('breakout-range');
  if (viral < VIRAL_RANGE.min || viral > VIRAL_RANGE.max) errors.push('viral-range');
  if (viral <= breakout) errors.push('viral-not-above');
  return errors;
}

/** "15,000", "15'000", "15 000" or "15000"; empty is not a number. */
export function parseImpressions(text: string): number {
  const t = text.trim().replace(/[\s,'’.]/g, '');
  return t === '' || !/^\d+$/.test(t) ? Number.NaN : Number(t);
}

/** Comma or dot as decimal separator; empty is not a number. */
export function parseMultiplier(text: string): number {
  const t = text.trim().replace(',', '.');
  return t === '' ? Number.NaN : Number(t);
}
