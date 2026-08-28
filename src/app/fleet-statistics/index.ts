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
import { FleetStatisticsComponent } from './fleet-statistics.component';
import { FleetStatisticsConfigComponent } from './fleet-statistics-config.component';
import { FLEET_STATISTICS_PREVIEW } from './preview-image';
import { WidgetTranslationService } from '../i18n.service';

@NgModule({
  imports: [FleetStatisticsComponent, FleetStatisticsConfigComponent],
  providers: [
    hookWidget({
      id: 'c8y.widget.fleet.statistics',
      label: gettext('Fleet Statistics'),
      description: gettext('Queries inventory with OData queries and visualizes device or asset distributions as interactive pie or donut charts.'),
      previewImage: FLEET_STATISTICS_PREVIEW,
      component: FleetStatisticsComponent,
      configComponent: FleetStatisticsConfigComponent,
      errorStrategy: DynamicComponentErrorStrategy.OVERLAY_ERROR,
      data: {
        settings: {
          noNewWidgets: false,
          ng1: {
            options: {
              noDeviceTarget: true,
              deviceTargetNotRequired: true
            }
          }
        }
      } as any,
    }),
  ]
})
export class FleetStatisticsWidgetModule {
  constructor(_i18n: WidgetTranslationService) {}
}

export { FleetStatisticsComponent, FleetStatisticsConfigComponent };
