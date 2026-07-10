/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { FormsModule } from '@angular/forms';
import { DatapointSelectorModule } from '@c8y/ngx-components/datapoint-selector';
import { DateTimePickerModule } from '@c8y/ngx-components';
import { hookWidgetConfig } from '@c8y/ngx-components/context-dashboard';
import { PRESET_NAME } from '@c8y/ngx-components/global-context';

import { ScatterPlotWidgetComponent } from './scatter-plot-widget.component';
import { ScatterPlotWidgetConfigComponent } from './scatter-plot-widget-config.component';
import { SCATTER_PLOT_PREVIEW } from './preview-image';

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
    DatapointSelectorModule,
    DateTimePickerModule
  ],
  declarations: [ScatterPlotWidgetComponent, ScatterPlotWidgetConfigComponent],
  exports: [ScatterPlotWidgetComponent, ScatterPlotWidgetConfigComponent],
  providers: [
    DatePipe,
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'scatter-plot-widget',
        label: 'Scatter Plot',
        description: 'Plots X vs Y telemetry measurements with a customizable time-based color gradient and live replay',
        previewImage: SCATTER_PLOT_PREVIEW,
        component: ScatterPlotWidgetComponent,
        configComponent: ScatterPlotWidgetConfigComponent,
        data: {
          controls: PRESET_NAME.DEFAULT,
          ng1: {
            options: {
              noDeviceTarget: true, // Disables asset target selection form in configuration
              noNewWidgets: false,
              deviceTargetNotRequired: true,
              groupsSelectable: true
            }
          }
        }
      }
    },
    // Hook Time context control panel
    hookWidgetConfig({
      widgetId: 'scatter-plot-widget',
      priority: 10,
      label: 'Time context',
      initialState: {
        controls: PRESET_NAME.DEFAULT
      },
      loadComponent: () =>
        import('@c8y/ngx-components/context-dashboard').then(m => m.GlobalContextSectionComponent)
    })
  ]
})
export class ScatterPlotWidgetModule {}
