/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { ParetoChartComponent } from './pareto-chart.component';
import { ParetoChartConfigComponent } from './pareto-chart-config.component';
import { PARETO_PREVIEW } from './preview-image';

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    ParetoChartComponent,
    ParetoChartConfigComponent
  ],
  exports: [ParetoChartComponent, ParetoChartConfigComponent],
  providers: [
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'c8y.widget.pareto.chart',
        label: 'Pareto Chart',
        description: 'Analyses alarms/events by type in a Pareto distribution.',
        previewImage: PARETO_PREVIEW,
        component: ParetoChartComponent,
        configComponent: ParetoChartConfigComponent,
        data: {
          settings: {
            noNewWidgets: false,
            groups: true,
            devices: true,
            assets: true,
            ng1: {
              options: {
                noDeviceTarget: false,
                groupsSelectable: true,
                devicesSelectable: true,
                deviceTargetNotRequired: false
              }
            }
          },
          groups: true,
          devices: true,
          assets: true
        }
      }
    }
  ]
})
export class ParetoChartWidgetModule {}
export { ParetoChartComponent, ParetoChartConfigComponent };
