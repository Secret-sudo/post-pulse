import { averageRanks, median, rollingMedian, roundRatio, spearman, sum } from './stats.ts';

describe('statistics helpers (SPEC §6)', () => {
  it('TC-A02 medians of empty, odd and even lists', () => {
    expect(median([])).toBeNull();
    expect(median([5])).toBe(5);
    expect(median([1, 3])).toBe(2);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([266, 268])).toBe(267);
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it('TC-A03 Spearman with identical, reversed, tied and constant series', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBeCloseTo(-1, 10);
    expect(spearman([1, 1, 2], [1, 2, 3])).toBeCloseTo(0.866, 4);
    expect(spearman([5, 5, 5], [1, 2, 3])).toBeNull();
    expect(spearman([1], [1])).toBeNull();
    expect(spearman([1, 2], [1])).toBeNull();
    expect(averageRanks([10, 20, 10, 30])).toEqual([1.5, 3, 1.5, 4]);
  });

  it('TC-A06 rolling median over the trailing 7 values', () => {
    expect(rollingMedian([10, 20, 30, 40, 50, 60, 70, 80], 7)).toEqual([
      10, 15, 20, 25, 30, 35, 40, 50,
    ]);
  });

  it('rounds ratios to 4 decimals and sums', () => {
    expect(roundRatio(90 / 100 - 1)).toBe(-0.1);
    expect(roundRatio(210 / 267 - 1)).toBe(-0.2135);
    expect(sum([])).toBe(0);
  });
});
