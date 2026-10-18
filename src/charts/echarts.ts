// The only module that imports ECharts. It's loaded with import() so the
// library stays out of the initial bundle (SPEC §10.3), and imports only the
// parts we use (SPEC §13 #11). SVG renderer: crisp, and text stays text.
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([
  ScatterChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  LegendComponent,
  SVGRenderer,
]);

export { echarts };
