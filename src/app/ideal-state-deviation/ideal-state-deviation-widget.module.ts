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
import { hookWidgetConfig } from '@c8y/ngx-components/context-dashboard';

import { IdealStateDeviationWidgetComponent } from './ideal-state-deviation-widget.component';
import { IdealStateDeviationWidgetConfigComponent } from './ideal-state-deviation-widget-config.component';
import { IDEAL_STATE_DEVIATION_PREVIEW } from './preview-image';

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
    DatapointSelectorModule
  ],
  declarations: [IdealStateDeviationWidgetComponent, IdealStateDeviationWidgetConfigComponent],
  exports: [IdealStateDeviationWidgetComponent, IdealStateDeviationWidgetConfigComponent],
  providers: [
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'ideal-state-deviation-widget',
        label: 'Ideal State Deviation',
        description: 'Scores an asset from 0 to 100 based on deviation from configured target ranges.',
        previewImage: IDEAL_STATE_DEVIATION_PREVIEW,
        component: IdealStateDeviationWidgetComponent,
        configComponent: IdealStateDeviationWidgetConfigComponent,
        data: {
          ng1: {
            options: {
              noDeviceTarget: false,
              noNewWidgets: false,
              deviceTargetNotRequired: false,
              groupsSelectable: true
            }
          }
        }
      }
    },
    hookWidgetConfig({
      widgetId: 'ideal-state-deviation-widget',
      priority: 20,
      label: 'Data point selection',
      initialState: {
        minActiveCount: 1,
        maxActiveCount: 10,
        controlName: 'datapoints',
        defaultFormOptions: {
          showRange: true,
          showTarget: true,
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
export class IdealStateDeviationWidgetModule {}
