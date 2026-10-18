import type { EChartsCoreOption } from 'echarts/core';
import type { ChartTheme } from '../../charts/theme.ts';
import type { Rhythm } from './model.ts';

export interface RhythmLabels {
  regular: string;
  viral: string;
  posts: string;
  impressions: string;
  formatInt: (v: number) => string;
  /** Axis label for a period's first day. */
  period: (start: string) => string;
}

/** Impressions per period, regular vs viral stacked, with posts per period as a line (SPEC §6.3). */
export function rhythmOption(r: Rhythm, theme: ChartTheme, l: RhythmLabels): EChartsCoreOption {
  return {
    animation: false,
    textStyle: { fontFamily: 'inherit', color: theme.text },
    grid: { left: 56, right: 40, top: 32, bottom: 56 },
    legend: { bottom: 0, textStyle: { color: theme.muted }, itemWidth: 10, itemHeight: 10 },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: r.points.map((w) => l.period(w.start)),
      axisLabel: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.border } },
    },
    yAxis: [
      {
        type: 'value',
        name: l.impressions,
        nameTextStyle: { color: theme.muted, align: 'left' },
        axisLabel: { color: theme.muted, formatter: (v: number) => l.formatInt(v) },
        splitLine: { lineStyle: { color: theme.border, opacity: 0.6 } },
      },
      {
        type: 'value',
        name: l.posts,
        minInterval: 1,
        nameTextStyle: { color: theme.muted, align: 'right' },
        axisLabel: { color: theme.muted },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        id: 'regular',
        name: l.regular,
        type: 'bar',
        stack: 'impressions',
        data: r.points.map((w) => w.impressionsRegular),
        itemStyle: { color: theme.accent },
      },
      {
        id: 'viral',
        name: l.viral,
        type: 'bar',
        stack: 'impressions',
        data: r.points.map((w) => w.impressionsViral),
        itemStyle: { color: theme.negative },
      },
      {
        id: 'posts',
        name: l.posts,
        type: 'line',
        yAxisIndex: 1,
        data: r.points.map((w) => w.posts),
        lineStyle: { color: theme.text, width: 2 },
        itemStyle: { color: theme.text },
        symbolSize: 5,
      },
    ],
  };
}
