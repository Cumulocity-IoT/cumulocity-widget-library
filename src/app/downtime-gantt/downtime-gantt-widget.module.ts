/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { FormsModule } from '@angular/forms';
import { hookWidgetConfig } from '@c8y/ngx-components/context-dashboard';
import { PRESET_NAME, GlobalContextConnectorComponent, LocalControlsComponent } from '@c8y/ngx-components/global-context';
import { AssetSelectorModule } from '@c8y/ngx-components/assets-navigator';
import { ModalModule } from 'ngx-bootstrap/modal';
import { DatapointSelectorModule } from '@c8y/ngx-components/datapoint-selector';

import { DowntimeGanttWidgetComponent } from './downtime-gantt-widget.component';
import { DowntimeGanttWidgetConfigComponent } from './downtime-gantt-widget-config.component';
import { DOWNTIME_GANTT_PREVIEW } from './preview-image';

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    FormsModule,
    GlobalContextConnectorComponent,
    LocalControlsComponent,
    AssetSelectorModule,
    DatapointSelectorModule,
    ModalModule.forRoot()
  ],
  declarations: [DowntimeGanttWidgetComponent, DowntimeGanttWidgetConfigComponent],
  exports: [DowntimeGanttWidgetComponent, DowntimeGanttWidgetConfigComponent],
  providers: [
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'downtime-gantt-widget',
        label: 'Downtime Gantt Diagram',
        description: 'Visualizes machine states over time based on measurements or events with custom mappings.',
        previewImage: DOWNTIME_GANTT_PREVIEW,
        component: DowntimeGanttWidgetComponent,
        configComponent: DowntimeGanttWidgetConfigComponent,
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
      widgetId: 'downtime-gantt-widget',
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
export class DowntimeGanttWidgetModule {}
