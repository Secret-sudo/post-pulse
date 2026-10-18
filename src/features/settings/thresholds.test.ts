import { parseImpressions, parseMultiplier, validateThresholds } from './thresholds.ts';

describe('threshold settings', () => {
  it('accepts the defaults and sensible values', () => {
    expect(validateThresholds(3, 10)).toEqual([]);
    expect(validateThresholds(1.5, 2)).toEqual([]);
    expect(validateThresholds(20, 100)).toEqual([]);
  });

  it('rejects values out of range and viral not above breakout', () => {
    expect(validateThresholds(1, 10)).toEqual(['breakout-range']);
    expect(validateThresholds(3, 200)).toEqual(['viral-range']);
    expect(validateThresholds(5, 5)).toEqual(['viral-not-above']);
    expect(validateThresholds(Number.NaN, 10)).toEqual(['not-a-number']);
  });

  it('reads comma and dot decimals', () => {
    expect(parseMultiplier('2,5')).toBe(2.5);
    expect(parseMultiplier(' 4.0 ')).toBe(4);
    expect(parseMultiplier('')).toBeNaN();
    expect(parseMultiplier('abc')).toBeNaN();
  });

  it('checks a fixed viral number of impressions instead of the multiplier', () => {
    expect(validateThresholds(3, Number.NaN, 15000)).toEqual([]);
    expect(validateThresholds(3, 10, 99)).toEqual(['impressions-range']);
    expect(validateThresholds(3, 10, 10_000_001)).toEqual(['impressions-range']);
    expect(validateThresholds(3, 10, 1500.5)).toEqual(['impressions-range']);
    expect(validateThresholds(3, 10, Number.NaN)).toEqual(['not-a-number']);
    expect(validateThresholds(1, 10, 15000)).toEqual(['breakout-range']);
  });

  it('reads impressions with thousands separators', () => {
    expect(parseImpressions('15,000')).toBe(15000);
    expect(parseImpressions("15'000")).toBe(15000);
    expect(parseImpressions('15 000')).toBe(15000);
    expect(parseImpressions('')).toBeNaN();
    expect(parseImpressions('1.5k')).toBeNaN();
  });
});
