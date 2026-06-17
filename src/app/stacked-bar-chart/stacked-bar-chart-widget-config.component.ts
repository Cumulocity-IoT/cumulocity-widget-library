/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';

@Component({
  selector: 'lib-stacked-bar-chart-widget-config',
  standalone: false,
  template: `
    <div class="form-group">
      <label translate>Data Limit</label>
      <input type="number" class="form-control" [(ngModel)]="config.limit" name="limit" min="1" max="2000" placeholder="50">
    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <lib-stacked-bar-chart-widget [config]="config"></lib-stacked-bar-chart-widget>
    </ng-template>
  `,
})
export class StackedBarChartWidgetConfigComponent implements OnInit {
  @Input() config: any = {};

  private widgetConfigService = inject(WidgetConfigService);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    if (!this.config.limit) {
      this.config.limit = 50;
    }
    if (this.config.dateContext === 'widget') {
      delete this.config.dateContext;
    }
  }
}
