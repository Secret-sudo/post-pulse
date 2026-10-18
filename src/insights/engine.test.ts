// @vitest-environment node
import expected from '../../fixtures/synthetic/syn-insights.expected.json';
import { readFixture } from '../../tests/builders/db.ts';
import { DEFAULT_ANALYSIS_SETTINGS } from '../../tests/builders/posts.ts';
import { headline } from '../analysis/metrics.ts';
import type { Dataset } from '../analysis/types.ts';
import { importFile } from '../import/importFile.ts';
import { compareInsights, generateInsights, overviewInsights } from './engine.ts';
import type { Insight } from './types.ts';

async function load(file: string): Promise<Dataset> {
  const r = await importFile(readFixture(file), file);
  if (!r.ok) throw new Error(r.error.code);
  return { posts: r.posts, latestExportDate: r.rangeEnd };
}

describe('insights engine (SPEC §7)', () => {
  let insights: Insight[];
  let dataset: Dataset;

  beforeAll(async () => {
    dataset = await load(expected.insights.file);
    insights = generateInsights(dataset, DEFAULT_ANALYSIS_SETTINGS);
  });

  it('the insight fixture has the designed shape', () => {
    const e = expected.insights;
    const h = headline(dataset, DEFAULT_ANALYSIS_SETTINGS);
    expect(dataset.posts).toHaveLength(e.posts);
    expect(h.thresholds).toEqual({
      personalMedian: e.personalMedian,
      breakout: e.breakout,
      viral: e.viral,
    });
    expect(h.windows[0]?.metrics).toMatchObject(e.w3);
    expect(h.windows[1]?.metrics).toMatchObject(e.w2);
    expect(h.windows[2]?.metrics).toMatchObject(e.w1);
  });

  it('TC-I02 every Phase 1 rule fires on the insight fixture, in the designed order', () => {
    expect(insights.map((i) => i.id)).toEqual(expected.insights.orderedIds);
    expect(Object.fromEntries(insights.map((i) => [i.id, i.severity]))).toEqual(
      expected.insights.severities,
    );
    for (const [id, title] of Object.entries(expected.insights.titles)) {
      expect(insights.find((i) => i.id === id)?.title, id).toBe(title);
    }
    for (const [id, size] of Object.entries(expected.insights.effectSizes)) {
      expect(insights.find((i) => i.id === id)?.effectSize, id).toBeCloseTo(size, 4);
    }
  });

  it('TC-I03 the quiet fixture raises no warning or critical insight', async () => {
    const quiet = generateInsights(await load(expected.quiet.file), DEFAULT_ANALYSIS_SETTINGS);
    expect(quiet.map((i) => i.id)).toEqual(expected.quiet.orderedIds);
    expect(quiet.filter((i) => i.severity === 'warning' || i.severity === 'critical')).toEqual([]);
  });

  it('TC-I04 orders by severity, then effect size, then id', () => {
    const mk = (id: string, severity: Insight['severity'], effectSize: number): Insight => ({
      id,
      ruleId: 'growing_posts',
      severity,
      effectSize,
      title: id,
      evidence: '',
      suggestion: '',
    });
    const shuffled = [
      mk('i-small', 'info', 0.1),
      mk('p', 'positive', 5),
      mk('w-b', 'warning', 0.5),
      mk('c', 'critical', 0.01),
      mk('i-big', 'info', 2),
      mk('w-a', 'warning', 0.5),
      mk('w-big', 'warning', 0.9),
    ];
    expect([...shuffled].sort(compareInsights).map((i) => i.id)).toEqual([
      'c',
      'w-big',
      'w-a',
      'w-b',
      'p',
      'i-big',
      'i-small',
    ]);
  });

  it('TC-I06 picks the overview five: two per family, one positive, notes last', () => {
    expect(overviewInsights(insights).map((i) => i.id)).toEqual(expected.insights.overviewIds);
  });

  it('TC-I06 notes come after findings and only fill free slots', () => {
    const mk = (
      id: string,
      ruleId: Insight['ruleId'],
      severity: Insight['severity'],
      effectSize: number,
    ): Insight => ({
      id,
      ruleId,
      severity,
      effectSize,
      title: id,
      evidence: '',
      suggestion: '',
    });
    const list = [
      mk('growing_posts', 'growing_posts', 'info', 0.5),
      mk('reach_decline', 'reach_decline', 'warning', 0.2),
      mk('resonance_holds', 'resonance_holds', 'info', 0.2),
      mk('no_breakouts', 'no_breakouts', 'warning', 1),
      mk('breakout_run', 'breakout_run', 'positive', 0.5),
    ].sort(compareInsights);
    expect(list.map((i) => i.id)).toEqual([
      'no_breakouts',
      'reach_decline',
      'breakout_run',
      'growing_posts',
      'resonance_holds',
    ]);
    // breakout_run is the only positive; the reach family is full, so it replaces
    // reach_decline, which comes back once a slot is free.
    expect(overviewInsights(list).map((i) => i.id)).toEqual([
      'no_breakouts',
      'reach_decline',
      'breakout_run',
      'growing_posts',
      'resonance_holds',
    ]);
    const full = [
      mk('w1', 'weak_format', 'warning', 0.9),
      mk('w2', 'weak_format', 'warning', 0.8),
      mk('w3', 'weak_format', 'warning', 0.7),
      mk('c', 'comment_drought', 'warning', 0.6),
      mk('d', 'same_day_split', 'warning', 0.5),
      mk('o', 'oon_shift', 'warning', 0.4),
      mk('g', 'growing_posts', 'info', 1),
    ].sort(compareInsights);
    expect(overviewInsights(full).map((i) => i.id)).toEqual(['w1', 'w2', 'c', 'd', 'o']);
  });

  it('TC-I05 wording never claims causation and always shows a sample size', () => {
    expect(insights.length).toBeGreaterThanOrEqual(11);
    for (const i of insights) {
      const text = `${i.title} ${i.evidence} ${i.suggestion}`;
      expect(text, i.id).not.toMatch(
        /\b(because|caused|causes|causing|due to|leads? to|results? in)\b/i,
      );
      expect(i.evidence, i.id).toMatch(/\b\d[\d,]* posts?\b/);
      expect(i.title.trim(), i.id).not.toBe('');
      expect(i.suggestion.trim(), i.id).not.toBe('');
    }
  });
});
