import { fireEvent, render, screen } from '@testing-library/react';
import type { Kpi } from '../features/overview/kpis.ts';
import { formatKpiValue, KpiTile } from './KpiTile.tsx';

const base: Kpi = {
  id: 'medianImpressions',
  value: 210,
  prior: 267,
  change: 210 / 267 - 1,
  status: 'slipping',
  series: [
    { start: '2026-09-15', end: '2026-09-21', value: 371, posts: 4 },
    { start: '2026-09-22', end: '2026-09-28', value: null, posts: 0 },
    { start: '2026-09-29', end: '2026-10-05', value: 267, posts: 3 },
    { start: '2026-10-06', end: '2026-10-12', value: 210, posts: 1 },
  ],
  format: 'number',
  posts: 19,
  priorPosts: 26,
};

describe('KPI tile', () => {
  it('shows value, signed change with words for screen readers, sample sizes and status', () => {
    render(<KpiTile kpi={base} />);
    expect(screen.getByRole('heading', { name: 'Median impressions' })).toBeInTheDocument();
    expect(screen.getByTestId('kpi-value')).toHaveTextContent('210');
    expect(screen.getByTestId('kpi-change')).toHaveTextContent('▼ 21.3 %');
    expect(screen.getByText('down 21.3 %')).toBeInTheDocument();
    expect(screen.getByText('19 posts vs 26')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-status')).toHaveTextContent('Slipping');
    expect(
      screen.getByRole('img', {
        name: 'Median impressions over the selected window: Sep 15 – Sep 21, 2026: 371 (4 posts); Sep 22 – Sep 28, 2026: – (0 posts); Sep 29 – Oct 5, 2026: 267 (3 posts); Oct 6 – Oct 12, 2026: 210 (1 post)',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tooltip')).toHaveTextContent(/middle value of impressions/);
  });

  it('has no change or chip without an earlier window', () => {
    render(
      <KpiTile kpi={{ ...base, prior: null, change: null, status: null, priorPosts: null }} />,
    );
    expect(screen.getByText('No earlier window')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-status')).toBeNull();
  });

  it('sparkline shows a point’s dates and value on hover and with the arrow keys', async () => {
    render(<KpiTile kpi={base} />);
    const spark = screen.getByTestId('sparkline');
    fireEvent.focus(spark);
    expect(screen.getByTestId('sparkline-tip')).toHaveTextContent(
      'Oct 6 – Oct 12, 2026: 210 (1 post)',
    );
    fireEvent.keyDown(spark, { key: 'ArrowLeft' });
    expect(screen.getByTestId('sparkline-tip')).toHaveTextContent(
      'Sep 29 – Oct 5, 2026: 267 (3 posts)',
    );
    fireEvent.blur(spark);
    expect(screen.queryByTestId('sparkline-tip')).toBeNull();
  });

  it('formats rates, counts and missing values', () => {
    expect(formatKpiValue({ format: 'rate' }, 0.0192)).toBe('1.9 %');
    expect(formatKpiValue({ format: 'int' }, 1234)).toBe('1,234');
    expect(formatKpiValue({ format: 'number' }, 183.5)).toBe('183.5');
    expect(formatKpiValue({ format: 'number' }, null)).toBe('–');
  });
});
