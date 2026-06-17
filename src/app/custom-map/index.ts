/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { DynamicComponentErrorStrategy, hookWidget } from '@c8y/ngx-components';
import { CustomMapWidgetComponent } from './custom-map-widget.component';
import { CustomMapWidgetConfigComponent } from './custom-map-widget-config.component';
import { CUSTOM_MAP_PREVIEW } from './preview-image';

@NgModule({
  imports: [CustomMapWidgetComponent, CustomMapWidgetConfigComponent],
  providers: [
    hookWidget({
      id: 'c8y.widget.custom.map',
      label: 'Custom Map Tracker',
      description: 'Displays a custom map with dynamic tracking markers using GPS or custom coordinate systems.',
      previewImage: CUSTOM_MAP_PREVIEW,
      component: CustomMapWidgetComponent,
      configComponent: CustomMapWidgetConfigComponent,
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
export class CustomMapWidgetModule {}

export { CustomMapWidgetComponent, CustomMapWidgetConfigComponent };
