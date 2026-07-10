# Cumulocity Widget Library

A collection of custom dashboard widgets for the Cumulocity platform. This library provides advanced visualization capabilities to enhance your dashboards.

## Overview

The library contains the following custom widgets:

<table>
  <tr>
    <td valign="top" width="50%">
      <h4>1. Alarm Heatmap Widget</h4>
      <p>Visualizes alarm frequency over time as a configurable grid heatmap.</p>
      <img src="public/alarm-heatmap-preview.png" width="350" alt="Alarm Heatmap Preview"/>
    </td>
    <td valign="top" width="50%">
      <h4>2. Stacked Bar Chart Widget</h4>
      <p>Displays a stacked bar chart with selected data points.</p>
      <img src="public/stacked-bar-chart-preview.png" width="350" alt="Stacked Bar Chart Preview"/>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <h4>3. Custom Map Widget</h4>
      <p>Displays a map with dynamic tracking markers using GPS or custom coordinates.</p>
      <img src="public/custom-map-preview.png" width="350" alt="Custom Map Preview"/>
    </td>
    <td valign="top" width="50%">
      <h4>4. SPC Chart Widget</h4>
      <p>Statistical Process Control line chart with control limits and annotations.</p>
      <img src="public/spc-chart-preview.png" width="350" alt="SPC Chart Preview"/>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <h4>5. Sankey Diagram Widget</h4>
      <p>Displays the breakdown flow of alarms/events down the asset/group hierarchy.</p>
      <img src="public/sankey-diagram-preview.png" width="350" alt="Sankey Diagram Preview"/>
    </td>
    <td valign="top" width="50%">
      <h4>6. Pareto Chart Widget</h4>
      <p>Analyses alarms/events by type in a Pareto distribution, highlighting frequent occurrences.</p>
      <img src="public/pareto-chart-preview.png" width="350" alt="Pareto Chart Preview"/>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <h4>7. Radar Chart Widget</h4>
      <p>Allows comparing up to 5 devices across up to 10 datapoints, rendering missing data points visually.</p>
      <img src="public/radar-chart-preview.png" width="350" alt="Radar Chart Preview"/>
    </td>
    <td valign="top" width="50%">
      <h4>8. Ideal State Deviation Widget</h4>
      <p>Scores an asset from 0 to 100 based on deviation from configured target ranges.</p>
      <img src="public/ideal-state-deviation-preview.svg" width="350" alt="Ideal State Deviation Preview"/>
    </td>
  </tr>
  <tr>
    <td valign="top" width="50%">
      <h4>9. Downtime Gantt Widget</h4>
      <p>Visualizes machine states over time based on measurements or events with custom mappings.</p>
    </td>
    <td valign="top" width="50%">
      <h4>10. Scatter Plot Widget</h4>
      <p>Plots X vs Y telemetry measurements with a customizable time-based color gradient and live replay.</p>
      <img src="public/scatter-plot-preview.png" width="350" alt="Scatter Plot Preview"/>
    </td>
  </tr>
</table>



## Installation

### Prerequisites
- Cumulocity Web SDK (compatible with v1023.82.4 or later)
- Node.js (v18 or v20 recommended)
- Angular CLI

> [!IMPORTANT]
> **Compatibility Note**: These widgets require Cumulocity Cockpit / Web SDK version **1023.0.0 or later**. Attempting to load them into older versions (such as v1022) will fail at runtime with loading/dependency errors (e.g., `TypeError: Cannot read properties of undefined (reading 'hasOwnProperty')` or `NG0200` dependency injection errors) due to missing runtime exports in the host platform.


### Installing the Plugin
To install this widget library as a plugin in your Cumulocity application:

1. Install the package dependencies in your project:
   ```bash
   npm install cumulocity-widget-library
   ```

2. Add the modules of the widgets you want to use to your application's `app.module.ts`:
   ```typescript
     import { 
       AlarmHeatmapWidgetModule, 
       StackedBarChartWidgetModule, 
       CustomMapWidgetModule, 
       SpcChartWidgetModule, 
       SankeyDiagramWidgetModule, 
       ParetoChartWidgetModule, 
       RadarChartWidgetModule, 
       IdealStateDeviationWidgetModule,
       DowntimeGanttWidgetModule,
       ScatterPlotWidgetModule
     } from 'cumulocity-widget-library';

     @NgModule({
       imports: [
         // ... other imports
         AlarmHeatmapWidgetModule,
         StackedBarChartWidgetModule,
         CustomMapWidgetModule,
         SpcChartWidgetModule,
         SankeyDiagramWidgetModule,
         ParetoChartWidgetModule,
         RadarChartWidgetModule,
         IdealStateDeviationWidgetModule,
         DowntimeGanttWidgetModule,
         ScatterPlotWidgetModule
       ]
     })
    export class AppModule {}
   ```

## Quick Start

### Running Locally
To start a local development server for testing the widgets:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run start
   ```

3. Open your browser and navigate to `http://localhost:4200/`.

## Build

To compile the library and build the production-ready plugin package:

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory, ready to be uploaded to your Cumulocity administration application under the Ecosystem -> Applications tab.

## Contributing

We welcome contributions to this project! Please read [CONTRIBUTING.md](file:///Users/tobias/repos/cumulocity-widget-library/CONTRIBUTING.md) and sign the [CONTRIBUTOR-LICENSE-AGREEMENT.md](file:///Users/tobias/repos/cumulocity-widget-library/CONTRIBUTOR-LICENSE-AGREEMENT.md) before submitting a Pull Request.

These tools are provided as-is and without warranty or support. They do not constitute part of the Cumulocity product suite. Users are free to use, fork and modify them, subject to the license agreement.

For more information or help, please visit the [Cumulocity TechCommunity](https://community.cumulocity.com/).

