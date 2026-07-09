import type { ConfigurationOptions } from '@c8y/devkit';
import { name, version } from './package.json';

export default {
  runTime: {
    name: name,
    version: version,
    remotes: {
      [name]: [
        'AlarmHeatmapWidgetModule',
        'StackedBarChartWidgetModule',
        'CustomMapWidgetModule',
        'SpcChartWidgetModule',
        'SankeyDiagramWidgetModule',
        'ParetoChartWidgetModule',
        'RadarChartWidgetModule',
        'IdealStateDeviationWidgetModule'
      ]
    },
    package: 'plugin',
    isPackage: true,
    noAppSwitcher: true,
    exports: [
      {
        name: 'Alarm Heatmap Widget',
        module: 'AlarmHeatmapWidgetModule',
        path: './src/app/alarm-heatmap/index.ts',
        description: 'Visualizes alarm frequency over time as a configurable grid heatmap'
      },
      {
        name: 'Stacked Bar Chart Widget',
        module: 'StackedBarChartWidgetModule',
        path: './src/app/stacked-bar-chart/index.ts',
        description: 'Displays a stacked bar chart with selected data points'
      },
      {
        name: 'Custom Map Widget',
        module: 'CustomMapWidgetModule',
        path: './src/app/custom-map/index.ts',
        description: 'Displays a custom map with dynamic tracking markers using GPS or custom coordinates'
      },
      {
        name: 'SPC Chart Widget',
        module: 'SpcChartWidgetModule',
        path: './src/app/spc-chart/index.ts',
        description: 'Statistical Process Control line chart with control limits and annotations'
      },
      {
        name: 'Sankey Diagram Widget',
        module: 'SankeyDiagramWidgetModule',
        path: './src/app/sankey-diagram/index.ts',
        description: 'Displays the breakdown flow of alarms/events down the asset/group hierarchy'
      },
      {
        name: 'Pareto Chart Widget',
        module: 'ParetoChartWidgetModule',
        path: './src/app/pareto-chart/index.ts',
        description: 'Analyses alarms/events by type in a Pareto distribution'
      },
      {
        name: 'Radar Chart Widget',
        module: 'RadarChartWidgetModule',
        path: './src/app/radar-chart/index.ts',
        description: 'Allows comparing up to 5 devices across up to 10 datapoints, rendering missing data points visually'
      },
      {
        name: 'Ideal State Deviation Widget',
        module: 'IdealStateDeviationWidgetModule',
        path: './src/app/ideal-state-deviation/index.ts',
        description: 'Scores an asset from 0 to 100 based on deviation from configured target ranges.'
      }
    ]
  },
  buildTime: {
    federation: [
      '@angular/core',
      '@angular/common',
      '@angular/forms',
      '@angular/router',
      '@c8y/client',
      '@c8y/ngx-components',
      '@ngx-translate/core'
    ]
  }
} as const satisfies ConfigurationOptions;
