import {
  daysBetween,
  parseDate,
  parseDuration,
  parseInteger,
  parsePercent,
  parseSlashDate,
} from './normalise.ts';

describe('value parsing (SPEC §4.3)', () => {
  it('TC-P01 reads integers with every thousands separator', () => {
    expect(parseInteger('212').value).toBe(212);
    for (const v of ['1,234', "1'234", '1’234', '1.234', '1 234', '1 234', '1 234']) {
      expect(parseInteger(v)).toEqual({ value: 1234 });
    }
    expect(parseInteger(1234.0).value).toBe(1234);
    expect(parseInteger(1233.6).value).toBe(1234);
  });

  it('TC-P02 treats empty markers as null and flags non-numbers', () => {
    for (const v of ['', ' ', '-', '–', null, undefined])
      expect(parseInteger(v)).toEqual({ value: null });
    for (const v of ['abc', '12a', '-5', '1.5e3']) {
      const r = parseInteger(v);
      expect(r.value).toBeNull();
      expect(r.problem).toBeDefined();
    }
  });

  it('TC-P03 parses durations with day, hour, minute and second units', () => {
    const cases: [string, number][] = [
      ['13s', 13],
      ['10m', 600],
      ['10m 1s', 601],
      ['1h 3m', 3780],
      ['6h 21m', 22860],
      ['1h 2m 3s', 3723],
      ['1d 13h', 133200],
      ['1D 13H', 133200],
    ];
    for (const [input, seconds] of cases) expect(parseDuration(input)).toEqual({ value: seconds });
    expect(parseDuration('')).toEqual({ value: null });
    for (const v of ['5 minutes', '10min', 'abc', '13']) {
      const r = parseDuration(v);
      expect(r.value).toBeNull();
      expect(r.problem).toBeDefined();
    }
  });

  it('TC-P04 parses percentages, fractions and clamps above 100', () => {
    expect(parsePercent('82%').value).toBe(82);
    expect(parsePercent('18 %').value).toBe(18);
    expect(parsePercent('0%').value).toBe(0);
    expect(parsePercent('100%').value).toBe(100);
    expect(parsePercent('82,5 %').value).toBe(82.5);
    expect(parsePercent(0.18).value).toBe(18);
    expect(parsePercent(45).value).toBe(45);
    expect(parsePercent('')).toEqual({ value: null });
    const over = parsePercent('120%');
    expect(over.value).toBe(100);
    expect(over.problem).toBeDefined();
    expect(parsePercent('lots').problem).toBeDefined();
  });

  it('TC-P05 reads EN, DE, FR, ISO, Excel serial and native dates', () => {
    expect(parseDate('10/14/2026', 'MDY').value).toBe('2026-10-14');
    expect(parseDate('7/1/2026', 'MDY').value).toBe('2026-07-01');
    expect(parseDate('14.10.2026', 'MDY').value).toBe('2026-10-14');
    expect(parseDate('14/10/2026', 'DMY').value).toBe('2026-10-14');
    expect(parseDate('2026-10-14', 'MDY').value).toBe('2026-10-14');
    expect(parseDate(46309, 'MDY').value).toBe('2026-10-14');
    expect(parseDate(new Date(2026, 9, 14), 'MDY').value).toBe('2026-10-14');
  });

  it('TC-P05 rejects impossible dates instead of rolling them over', () => {
    for (const v of ['13/14/2026', '2/30/2026', '2026-13-01', 'yesterday']) {
      const r = parseDate(v, 'MDY');
      expect(r.value).toBeNull();
      expect(r.problem).toBeDefined();
    }
    expect(parseDate('', 'MDY')).toEqual({ value: null });
    expect(parseSlashDate('13/10/2026', 'MDY')).toBeNull();
    expect(parseSlashDate('13/10/2026', 'DMY')).toBe('2026-10-13');
  });

  it('counts whole days between ISO dates', () => {
    expect(daysBetween('2026-10-07', '2026-10-14')).toBe(7);
    expect(daysBetween('2026-10-14', '2026-10-14')).toBe(0);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });
});
