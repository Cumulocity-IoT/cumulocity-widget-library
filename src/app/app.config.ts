/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AlarmHeatmapWidgetModule } from './alarm-heatmap/index';
import { StackedBarChartWidgetModule } from './stacked-bar-chart/index';
import { CustomMapWidgetModule } from './custom-map/index';
import { SpcChartWidgetModule } from './spc-chart/index';
import { SankeyDiagramWidgetModule } from './sankey-diagram/index';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    importProvidersFrom(
      AlarmHeatmapWidgetModule,
      StackedBarChartWidgetModule,
      CustomMapWidgetModule,
      SpcChartWidgetModule,
      SankeyDiagramWidgetModule
    )
  ]
};
