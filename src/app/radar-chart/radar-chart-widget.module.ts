/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { FormsModule } from '@angular/forms';
import { DatapointSelectorModule } from '@c8y/ngx-components/datapoint-selector';
import { DateTimePickerModule } from '@c8y/ngx-components';
import { hookWidgetConfig } from '@c8y/ngx-components/context-dashboard';
import { PRESET_NAME, GlobalContextConnectorComponent, LocalControlsComponent } from '@c8y/ngx-components/global-context';
import { AssetSelectorModule } from '@c8y/ngx-components/assets-navigator';
import { ModalModule } from 'ngx-bootstrap/modal';

import { RadarChartWidgetComponent } from './radar-chart-widget.component';
import { RadarChartWidgetConfigComponent } from './radar-chart-widget-config.component';
import { RADAR_CHART_PREVIEW } from './preview-image';

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
    DatapointSelectorModule,
    DateTimePickerModule,
    GlobalContextConnectorComponent,
    LocalControlsComponent,
    AssetSelectorModule,
    ModalModule.forRoot()
  ],
  declarations: [RadarChartWidgetComponent, RadarChartWidgetConfigComponent],
  exports: [RadarChartWidgetComponent, RadarChartWidgetConfigComponent],
  providers: [
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'radar-chart-widget',
        label: 'Radar/Spider Chart',
        description: 'Allows comparing up to 5 devices across up to 10 datapoints, rendering missing data points visually',
        previewImage: RADAR_CHART_PREVIEW,
        component: RadarChartWidgetComponent,
        configComponent: RadarChartWidgetConfigComponent,
        data: {
          controls: PRESET_NAME.DEFAULT,
          ng1: {
            options: {
              noDeviceTarget: true,
              noNewWidgets: false,
              deviceTargetNotRequired: true,
              groupsSelectable: true
            }
          }
        }
      }
    },
    hookWidgetConfig({
      widgetId: 'radar-chart-widget',
      priority: 10,
      label: 'Time context',
      initialState: {
        controls: PRESET_NAME.DEFAULT
      },
      loadComponent: () =>
        import('@c8y/ngx-components/context-dashboard').then(m => m.GlobalContextSectionComponent)
    }),
    hookWidgetConfig({
      widgetId: 'radar-chart-widget',
      priority: 20,
      label: 'Data point selection',
      initialState: {
        minActiveCount: 3,
        maxActiveCount: 10,
        controlName: 'datapoints',
        defaultFormOptions: {
          showRange: true,
          showYellowRange: false,
          showRedRange: false,
          showChart: false
        }
      },
      expanded: true,
      loadComponent: () =>
        import('@c8y/ngx-components/datapoint-selector').then(
          m => m.WidgetDatapointsSelectorComponent
        )
    })
  ]
})
export class RadarChartWidgetModule {}
