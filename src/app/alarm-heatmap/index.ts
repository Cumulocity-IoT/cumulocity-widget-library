import '../../locales/de.po';
import '../../locales/ja.po';
import '../../locales/ja_JP.po';
/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { DynamicComponentErrorStrategy, hookWidget, gettext } from '@c8y/ngx-components';
import { AlarmHeatmapComponent } from './alarm-heatmap.component';
import { AlarmHeatmapConfigComponent } from './alarm-heatmap-config.component';
import { ALARM_HEATMAP_PREVIEW } from './preview-image';

import { WidgetTranslationService } from '../i18n.service';

@NgModule({
  imports: [AlarmHeatmapComponent, AlarmHeatmapConfigComponent],
  providers: [
    hookWidget({
      id: 'c8y.widget.alarm.heatmap',
      label: gettext('Alarm Heatmap'),
      description: gettext('Visualizes alarm frequencies in a premium grid layout over a configured time range.'),
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
export class AlarmHeatmapWidgetModule {
  constructor(_i18n: WidgetTranslationService) {}
}

export { AlarmHeatmapComponent, AlarmHeatmapConfigComponent };
