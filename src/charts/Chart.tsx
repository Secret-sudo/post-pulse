// Mounts an ECharts chart once the library has loaded. Builds its option from
// the current theme and rebuilds it when light/dark mode changes.
import type { EChartsCoreOption, ECharts } from 'echarts/core';
import { useEffect, useRef, useState } from 'react';
import { readTheme, type ChartTheme } from './theme.ts';
import styles from './Chart.module.css';

export interface ChartClick {
  seriesId?: string;
  dataIndex: number;
}

interface Props {
  option: (theme: ChartTheme) => EChartsCoreOption;
  label: string;
  height?: number;
  onClick?: (e: ChartClick) => void;
  testId?: string;
}

function useThemeVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq?.removeEventListener?.('change', bump);
      mo.disconnect();
    };
  }, []);
  return version;
}

export function Chart({ option, label, height = 320, onClick, testId }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const clickRef = useRef(onClick);
  const [ready, setReady] = useState(false);
  const themeVersion = useThemeVersion();

  useEffect(() => {
    clickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    void import('./echarts.ts').then(({ echarts }) => {
      if (disposed || !el.current) return;
      const c = echarts.init(el.current, undefined, { renderer: 'svg' });
      c.on('click', (p) => {
        const params = p as { seriesId?: string; dataIndex?: number };
        if (typeof params.dataIndex === 'number') {
          clickRef.current?.({
            dataIndex: params.dataIndex,
            ...(params.seriesId ? { seriesId: params.seriesId } : {}),
          });
        }
      });
      chart.current = c;
      ro = new ResizeObserver(() => c.resize());
      ro.observe(el.current);
      setReady(true);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !chart.current || !el.current) return;
    chart.current.setOption(option(readTheme(el.current)), { notMerge: true });
  }, [ready, option, themeVersion]);

  return (
    <div
      ref={el}
      className={styles.chart}
      style={{ height }}
      role="img"
      aria-label={label}
      data-testid={testId}
      data-ready={ready ? 'true' : 'false'}
    />
  );
}
