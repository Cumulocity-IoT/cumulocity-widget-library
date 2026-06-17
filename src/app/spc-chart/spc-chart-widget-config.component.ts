/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoreModule } from '@c8y/ngx-components';
import { DatapointSelectorModule } from '@c8y/ngx-components/datapoint-selector';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { SpcChartWidgetComponent } from './spc-chart-widget.component';

@Component({
  selector: 'lib-spc-chart-widget-config',
  standalone: false,
  template: `


    <!-- Static Lines Section -->
    <div class="form-group">
      <label translate style="font-weight: bold; margin-bottom: 8px;">Static Lines</label>
      <div *ngIf="!config.staticLines || config.staticLines.length === 0" class="text-muted p-8">
        No static lines added.
      </div>
      <div *ngFor="let line of config.staticLines; let i = index" class="row style-row m-b-8" style="display: flex; align-items: center;">
        <div class="col-md-5">
          <input type="number" class="form-control" [(ngModel)]="line.value" placeholder="Value" name="line-value-{{i}}">
        </div>
        <div class="col-md-5">
          <input type="text" class="form-control" [(ngModel)]="line.label" placeholder="Label" name="line-label-{{i}}">
        </div>
        <div class="col-md-2">
          <button type="button" class="btn btn-clean btn-xs text-danger" (click)="removeLine(i)">
            <i c8yIcon="delete"></i>
          </button>
        </div>
      </div>
      <button type="button" class="btn btn-default btn-xs" (click)="addLine()">
        <i c8yIcon="plus-circle"></i> Add Line
      </button>
    </div>

    <hr />

    <!-- Areas Section -->
    <div class="form-group">
      <label translate style="font-weight: bold; margin-bottom: 8px;">Control Areas / Limits</label>
      <div *ngIf="!config.areas || config.areas.length === 0" class="text-muted p-8">
        No control areas added.
      </div>
      <div *ngFor="let area of config.areas; let i = index" class="p-8 m-b-8 border-bottom" style="border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 12px;">
        <div class="row style-row" style="margin-bottom: 8px; display: flex; align-items: center;">
          <div class="col-md-4">
            <select class="form-control" [(ngModel)]="area.type" name="area-type-{{i}}">
              <option value="upper">Upper Limit</option>
              <option value="lower">Lower Limit</option>
              <option value="range">Range</option>
            </select>
          </div>
          <div class="col-md-6">
            <input type="text" class="form-control" [(ngModel)]="area.label" placeholder="Area Label" name="area-label-{{i}}">
          </div>
          <div class="col-md-2 text-right">
            <button type="button" class="btn btn-clean btn-xs text-danger" (click)="removeArea(i)">
              <i c8yIcon="delete"></i>
            </button>
          </div>
        </div>

        <div class="row style-row" style="display: flex; align-items: center;">
          <div class="col-md-4" *ngIf="area.type !== 'range'">
            <input type="number" class="form-control" [(ngModel)]="area.value" placeholder="Threshold Value" name="area-val-{{i}}">
          </div>
          <div class="col-md-3" *ngIf="area.type === 'range'">
            <input type="number" class="form-control" [(ngModel)]="area.min" placeholder="Min Value" name="area-min-{{i}}">
          </div>
          <div class="col-md-3" *ngIf="area.type === 'range'">
            <input type="number" class="form-control" [(ngModel)]="area.max" placeholder="Max Value" name="area-max-{{i}}">
          </div>
          <div class="col-md-4">
            <div style="display: flex; align-items: center;">
              <input type="color" class="form-control-color" [(ngModel)]="area.color" name="area-color-{{i}}" style="width: 40px; height: 32px; padding: 2px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; margin-right: 8px;">
              <span>Color</span>
            </div>
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-default btn-xs" (click)="addArea()">
        <i c8yIcon="plus-circle"></i> Add Area
      </button>
    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <lib-spc-chart-widget [config]="config"></lib-spc-chart-widget>
    </ng-template>
  `,
  styles: [`
    .style-row {
      margin-left: 0;
      margin-right: 0;
    }
  `]
})
export class SpcChartWidgetConfigComponent implements OnInit {
  @Input() config: any = {};

  private widgetConfigService = inject(WidgetConfigService);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    if (!this.config.staticLines) {
      this.config.staticLines = [];
    }
    if (!this.config.areas) {
      this.config.areas = [];
    }
  }

  addLine() {
    this.config.staticLines.push({ value: 0, label: '' });
  }

  removeLine(index: number) {
    this.config.staticLines.splice(index, 1);
  }

  addArea() {
    this.config.areas.push({ type: 'upper', value: 0, min: 0, max: 0, label: '', color: '#ff0000' });
  }

  removeArea(index: number) {
    this.config.areas.splice(index, 1);
  }
}
