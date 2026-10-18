import { fmtChange, fmtDate, fmtNumber, fmtRange, fmtRate } from './format.ts';

describe('UI formatting', () => {
  it('formats numbers, rates and changes', () => {
    expect(fmtNumber(183.5)).toBe('183.5');
    expect(fmtNumber(48210)).toBe('48,210');
    expect(fmtRate(0.0192)).toBe('1.9 %');
    expect(fmtChange(-0.21348)).toEqual({
      text: '▼ 21.3 %',
      words: 'down 21.3 %',
      direction: 'down',
    });
    expect(fmtChange(0.1)).toEqual({ text: '▲ 10.0 %', words: 'up 10.0 %', direction: 'up' });
    expect(fmtChange(0.0001).direction).toBe('none');
  });

  it('formats dates in UTC so they never shift by a day', () => {
    expect(fmtDate('2026-10-14')).toBe('Oct 14, 2026');
    expect(fmtRange('2026-09-15', '2026-10-14')).toBe('Sep 15 – Oct 14, 2026');
  });
});
