import { DEFAULT_ANALYSIS_SETTINGS, makePost } from '../../../tests/builders/posts.ts';
import { headline } from '../../analysis/metrics.ts';
import type { ChartTheme } from '../../charts/theme.ts';
import { buildTimeline } from './timeline.ts';
import { pointForClick, timelineOption } from './timelineOption.ts';

const theme = {
  text: '#000',
  muted: '#666',
  border: '#ccc',
  surface: '#fff',
  accent: '#00f',
  accentSoft: '#eef',
  negative: '#f00',
  types: {
    Image: '#1',
    Video: '#2',
    Repost: '#3',
    Text: '#4',
    Article: '#5',
    Document: '#6',
    Poll: '#7',
    Celebration: '#8',
    Other: '#9',
  },
} satisfies ChartTheme;

const E = '2026-10-14';
const posts = [
  { ...makePost({ date: '2026-09-01', impressions: 100 }), title: '<img src=x onerror=alert(1)>' },
  makePost({ date: '2026-09-02', impressions: 900, type: 'Video' }),
  makePost({ date: '2026-09-03', impressions: 300 }),
];
const model = buildTimeline(
  posts,
  'impressions',
  headline({ posts, latestExportDate: E }, DEFAULT_ANALYSIS_SETTINGS).windows,
  0,
  true,
);
const labels = {
  metric: 'Impressions',
  median: 'Median',
  format: String,
  tooltip: (p: { title: string }) => p.title,
};

describe('timeline chart option', () => {
  it('has one scatter series per type, the median line and window bands', () => {
    const o = timelineOption(model, theme, labels) as {
      series: { id: string }[];
      yAxis: { type: string };
    };
    expect(o.series.map((s) => s.id)).toEqual(['windows', 'type:Image', 'type:Video', 'median']);
    expect(o.yAxis.type).toBe('log');
  });

  it('renders tooltips as rich text, never HTML', () => {
    const o = timelineOption(model, theme, labels) as {
      tooltip: {
        renderMode: string;
        formatter: (p: { seriesId?: string; dataIndex: number }) => string;
      };
    };
    expect(o.tooltip.renderMode).toBe('richText');
    expect(o.tooltip.formatter({ seriesId: 'type:Image', dataIndex: 0 })).toBe(
      '<img src=x onerror=alert(1)>',
    );
    expect(o.tooltip.formatter({ seriesId: 'median', dataIndex: 0 })).toBe('');
  });

  it('maps a click on a series point back to its post', () => {
    expect(pointForClick(model, 'type:Image', 1)?.value).toBe(300);
    expect(pointForClick(model, 'type:Video', 0)?.value).toBe(900);
    expect(pointForClick(model, 'median', 0)).toBeNull();
    expect(pointForClick(model, 'type:Image', 9)).toBeNull();
  });
});
