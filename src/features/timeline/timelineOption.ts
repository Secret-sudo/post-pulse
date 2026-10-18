// ECharts option for the timeline. Labels and tooltips are rendered as SVG
// text (tooltip renderMode 'richText'), so post titles are never parsed as HTML.
import type { EChartsCoreOption } from 'echarts/core';
import type { ChartTheme } from '../../charts/theme.ts';
import type { PostType } from '../../import/types.ts';
import { shortTitle, symbolSize, type TimelineModel, type TimelinePoint } from './timeline.ts';

export interface TimelineLabels {
  metric: string;
  median: string;
  format: (v: number) => string;
  tooltip: (p: TimelinePoint) => string;
}

const DAY = 86_400_000;
const ts = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function timelineOption(
  model: TimelineModel,
  theme: ChartTheme,
  labels: TimelineLabels,
): EChartsCoreOption {
  const byType = new Map<PostType, TimelinePoint[]>();
  for (const p of model.points) byType.set(p.type, [...(byType.get(p.type) ?? []), p]);

  const scatter = [...byType].map(([type, pts]) => ({
    id: `type:${type}`,
    name: type,
    type: 'scatter',
    data: pts.map((p) => ({
      value: [ts(p.date), p.value],
      symbolSize: symbolSize(p.comments),
      label: p.top
        ? {
            show: true,
            formatter: shortTitle(p.title || p.postId),
            position: 'top',
            color: theme.text,
            fontSize: 11,
          }
        : { show: false },
      // Keeps the click handler able to find the post.
      postId: p.postId,
    })),
    itemStyle: { color: theme.types[type], opacity: 0.85 },
    emphasis: { focus: 'series' },
  }));

  const bands = model.bands.map((b) => [
    {
      xAxis: ts(b.start),
      name: b.label,
      itemStyle: {
        color: b.selected ? theme.accentSoft : 'transparent',
        borderColor: theme.border,
        borderWidth: 1,
      },
      label: { color: theme.muted, position: 'insideTop', fontSize: 11 },
    },
    { xAxis: ts(b.end) + DAY },
  ]);

  return {
    animation: false,
    textStyle: { fontFamily: 'inherit', color: theme.text },
    grid: { left: 56, right: 16, top: 32, bottom: 48 },
    legend: { bottom: 0, textStyle: { color: theme.muted }, itemWidth: 10, itemHeight: 10 },
    tooltip: {
      trigger: 'item',
      renderMode: 'richText',
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontSize: 12 },
      formatter: (params: { seriesId?: string; dataIndex: number }) => {
        if (!params.seriesId?.startsWith('type:')) return '';
        const pts = byType.get(params.seriesId.slice(5) as PostType) ?? [];
        const p = pts[params.dataIndex];
        return p ? labels.tooltip(p) : '';
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: theme.muted },
      axisLine: { lineStyle: { color: theme.border } },
      splitLine: { show: false },
    },
    yAxis: {
      type: model.log ? 'log' : 'value',
      name: labels.metric,
      nameTextStyle: { color: theme.muted, align: 'left' },
      axisLabel: { color: theme.muted, formatter: (v: number) => labels.format(v) },
      splitLine: { lineStyle: { color: theme.border, opacity: 0.6 } },
      ...(model.log ? { logBase: 10 } : { min: 0 }),
    },
    series: [
      {
        id: 'windows',
        name: '',
        type: 'line',
        data: [],
        markArea: { silent: true, data: bands },
        tooltip: { show: false },
      },
      ...scatter,
      {
        id: 'median',
        name: labels.median,
        type: 'line',
        data: model.rolling.map((r) => [ts(r.date), r.value]),
        showSymbol: false,
        smooth: false,
        lineStyle: { color: theme.text, width: 2, opacity: 0.7 },
        itemStyle: { color: theme.text },
        tooltip: { show: false },
        z: 1,
      },
    ],
  };
}

/** Which post a click on a scatter series refers to. */
export function pointForClick(
  model: TimelineModel,
  seriesId: string | undefined,
  dataIndex: number,
) {
  if (!seriesId?.startsWith('type:')) return null;
  const type = seriesId.slice(5);
  return model.points.filter((p) => p.type === type)[dataIndex] ?? null;
}
