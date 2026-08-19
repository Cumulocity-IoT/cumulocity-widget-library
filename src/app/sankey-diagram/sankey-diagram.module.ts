/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS, gettext } from '@c8y/ngx-components';
import { SankeyDiagramComponent } from './sankey-diagram.component';
import { SankeyDiagramConfigComponent } from './sankey-diagram-config.component';
import { SANKEY_PREVIEW } from './preview-image';

import { WidgetTranslationService } from '../i18n.service';

@NgModule({
  imports: [
    CommonModule,
    CoreModule,
    SankeyDiagramComponent,
    SankeyDiagramConfigComponent
  ],
  exports: [SankeyDiagramComponent, SankeyDiagramConfigComponent],
  providers: [
    {
      provide: HOOK_COMPONENTS,
      multi: true,
      useValue: {
        id: 'c8y.widget.sankey.diagram',
        label: gettext('Sankey Diagram'),
        description: gettext('Displays the breakdown flow of alarms/events down the asset/group hierarchy.'),
        previewImage: SANKEY_PREVIEW,
        component: SankeyDiagramComponent,
        configComponent: SankeyDiagramConfigComponent,
        data: {
          settings: {
            noNewWidgets: false,
            groups: true,
            devices: false,
            assets: true,
            ng1: {
              options: {
                noDeviceTarget: false,
                groupsSelectable: true,
                devicesSelectable: false,
                deviceTargetNotRequired: false
              }
            }
          },
          groups: true,
          devices: false,
          assets: true
        }
      }
    }
  ]
})
export class SankeyDiagramWidgetModule {
  constructor(_i18n: WidgetTranslationService) {}
}
export { SankeyDiagramComponent, SankeyDiagramConfigComponent };
