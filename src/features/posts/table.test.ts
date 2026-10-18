import { DEFAULT_ANALYSIS_SETTINGS, makePost } from '../../../tests/builders/posts.ts';
import { buildRows, csvField, searchRows, sortRows, toCsv, type PostRow } from './table.ts';

const E = '2026-10-14';

describe('posts table model (SPEC §9.2)', () => {
  const history = [
    ...Array.from({ length: 10 }, (_, i) =>
      makePost({ date: `2026-08-${10 + i}`, impressions: 100, id: `74000000000000099${10 + i}` }),
    ),
    makePost({ date: '2026-09-01', impressions: 350, id: '7400000000000009001' }),
    makePost({ date: '2026-09-02', impressions: 1500, id: '7400000000000009002' }),
    makePost({ date: '2026-10-12', impressions: 5000, id: '7400000000000009003' }),
  ];

  it('marks growing, viral and breakout posts against the full-history median', () => {
    // Mature history median = 100 → breakout ≥ 300, viral ≥ 1000. The 5,000 post is only 2 days old.
    const rows = buildRows(history, history, E, DEFAULT_ANALYSIS_SETTINGS);
    const status = (id: string) => rows.find((r) => r.post.postId === id)?.status;
    expect(status('7400000000000009001')).toBe('breakout');
    expect(status('7400000000000009002')).toBe('viral');
    expect(status('7400000000000009003')).toBe('growing');
    expect(status('7400000000000009910')).toBeNull();
  });

  it('keeps statuses when the table shows a filtered subset', () => {
    const subset = history.slice(10, 11);
    expect(buildRows(subset, history, E, DEFAULT_ANALYSIS_SETTINGS)[0]?.status).toBe('breakout');
  });

  it('searches titles and types, ignoring case and accents, all terms required', () => {
    const rows: PostRow[] = [
      {
        post: { ...makePost({ date: '2026-09-01' }), title: 'Café culture in Zürich' },
        engagementRate: 0,
        status: null,
      },
      {
        post: { ...makePost({ date: '2026-09-02', type: 'Video' }), title: 'zurich banking' },
        engagementRate: 0,
        status: null,
      },
    ];
    expect(searchRows(rows, 'ZURICH').map((r) => r.post.title)).toEqual([
      'Café culture in Zürich',
      'zurich banking',
    ]);
    expect(searchRows(rows, 'cafe zurich')).toHaveLength(1);
    expect(searchRows(rows, 'video')).toHaveLength(1);
    expect(searchRows(rows, '   ')).toHaveLength(2);
  });

  it('sorts every column both ways, stable, newest first on ties', () => {
    const rows = buildRows(history, history, E, DEFAULT_ANALYSIS_SETTINGS);
    expect(sortRows(rows, { column: 'impressions', desc: true })[0]?.post.metrics.impressions).toBe(
      5000,
    );
    expect(
      sortRows(rows, { column: 'impressions', desc: false })[0]?.post.metrics.impressions,
    ).toBe(100);
    const ties = sortRows(rows, { column: 'impressions', desc: false })
      .slice(0, 10)
      .map((r) => r.post.publishDate);
    expect(ties).toEqual([...ties].sort().reverse());
    expect(sortRows(rows, { column: 'status', desc: true })[0]?.status).toBe('viral');
    for (const column of [
      'date',
      'type',
      'title',
      'outOfNetwork',
      'reactions',
      'comments',
      'reposts',
      'saves',
      'engagementRate',
    ] as const) {
      expect(sortRows(rows, { column, desc: true })).toHaveLength(rows.length);
    }
  });

  it('TC-N02 sorts 5,000 rows in under 100 ms', () => {
    const big = Array.from({ length: 5000 }, (_, i) =>
      makePost({ date: `2026-0${1 + (i % 9)}-1${i % 10}`, impressions: (i * 7919) % 10007 }),
    );
    const rows = buildRows(big, big, E, DEFAULT_ANALYSIS_SETTINGS);
    sortRows(rows, { column: 'impressions', desc: true }); // warm up
    const start = performance.now();
    sortRows(rows, { column: 'impressions', desc: false });
    expect(performance.now() - start).toBeLessThan(100);
  });

  it('writes CSV fields safely: quoting and no formula injection', () => {
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a, "quoted" title')).toBe('"a, ""quoted"" title"');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
    expect(csvField('=HYPERLINK("https://evil.example","click")')).toBe(
      `"'=HYPERLINK(""https://evil.example"",""click"")"`,
    );
    for (const s of ['+1', '-1', '@SUM(A1)', '\tx'])
      expect(csvField(s).replace(/^"/, '').startsWith("'"), s).toBe(true);
    expect(csvField(-5)).toBe('-5');
    expect(csvField(null)).toBe('');
  });

  it('exports the rows it is given with the visible columns and the URL', () => {
    const rows = sortRows(buildRows(history.slice(10), history, E, DEFAULT_ANALYSIS_SETTINGS), {
      column: 'impressions',
      desc: true,
    });
    const lines = toCsv(rows).trimEnd().split('\r\n');
    expect(lines[0]).toBe(
      'Publish date,Post type,Title,Impressions,Outside network %,Reactions,Comments,Reposts,Saves,Engagement rate %,Status,Post URL',
    );
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(
      /^2026-10-12,Image,post \d+,5000,30,2,1,0,0,0.06,growing,https:\/\/www\.linkedin\.com\//,
    );
  });
});
