/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { DynamicComponentErrorStrategy, hookWidget } from '@c8y/ngx-components';
import { AlarmHeatmapComponent } from './alarm-heatmap.component';
import { AlarmHeatmapConfigComponent } from './alarm-heatmap-config.component';
import { ALARM_HEATMAP_PREVIEW } from './preview-image';

@NgModule({
  imports: [AlarmHeatmapComponent, AlarmHeatmapConfigComponent],
  providers: [
    hookWidget({
      id: 'c8y.widget.alarm.heatmap',
      label: 'Alarm Heatmap',
      description: 'Visualizes alarm frequencies in a premium grid layout over a configured time range.',
      previewImage: ALARM_HEATMAP_PREVIEW,
      component: AlarmHeatmapComponent,
      configComponent: AlarmHeatmapConfigComponent,
      errorStrategy: DynamicComponentErrorStrategy.OVERLAY_ERROR,
      data: {
        settings: {
          noNewWidgets: false,
          groups: true,
          devices: true,
          assets: true,
          ng1: {
            options: {
              groupsSelectable: true,
              noDeviceTarget: false,
              deviceTargetNotRequired: false
            }
          }
        },
        groups: true,
        devices: true,
        assets: true
      } as any,
    }),
  ]
})
export class AlarmHeatmapWidgetModule {}

export { AlarmHeatmapComponent, AlarmHeatmapConfigComponent };
