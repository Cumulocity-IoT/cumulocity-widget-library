/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { ControlContainer, NgForm } from '@angular/forms';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { AlertService } from '@c8y/ngx-components';

@Component({
  selector: 'lib-scatter-plot-widget-config',
  standalone: false,
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  template: `
    <!-- Guard to ensure config and its nested aggregation properties are initialized before rendering template forms -->
    <div *ngIf="config && config.aggregation">
      
      <!-- Explicit X and Y Axis Selection - Stacked Vertically -->
      <div class="form-group border-bottom p-b-16 m-b-16">
        <div class="form-group m-b-16">
          <label class="control-label" style="font-weight: bold; margin-bottom: 8px;" translate>X-Axis Data Point</label>
          <div *ngIf="datapointSelectorClass" class="datapoint-selector-wrapper">
            <ng-container *ngComponentOutlet="datapointSelectorClass; inputs: { config: config, minActiveCount: 1, maxActiveCount: 1, controlName: 'datapointX', defaultFormOptions: { showRange: true }, removeTitle: true }"></ng-container>
          </div>
        </div>
        <div class="form-group">
          <label class="control-label" style="font-weight: bold; margin-bottom: 8px;" translate>Y-Axis Data Point</label>
          <div *ngIf="datapointSelectorClass" class="datapoint-selector-wrapper">
            <ng-container *ngComponentOutlet="datapointSelectorClass; inputs: { config: config, minActiveCount: 1, maxActiveCount: 1, controlName: 'datapointY', defaultFormOptions: { showRange: true }, removeTitle: true }"></ng-container>
          </div>
        </div>
      </div>

      <!-- Time Window Selector -->
      <div class="form-group">
        <label class="control-label" translate>Default Time Window</label>
        <select class="form-control" name="timeWindow" [(ngModel)]="config.timeWindow">
          <option value="lastMinute">Last Minute</option>
          <option value="lastHour">Last Hour</option>
          <option value="last2Hours">Last 2 Hours</option>
          <option value="last4Hours">Last 4 Hours</option>
          <option value="last8Hours">Last 8 Hours</option>
          <option value="lastDay">Last Day</option>
        </select>
      </div>

      <!-- Aggregation Section -->
      <div class="m-t-16 border-top p-t-16">
        <label style="font-weight: bold; display: block; margin-bottom: 12px;" translate>Aggregation Settings</label>
        
        <div class="form-group">
          <label class="c8y-checkbox">
            <input 
              type="checkbox" 
              name="aggActive" 
              [(ngModel)]="config.aggregation.active" 
            />
            <span></span>
            Enable Data Aggregation
          </label>
        </div>

        <div *ngIf="config.aggregation.active" class="row">
          <div class="col-md-6 form-group">
            <label class="control-label" translate>Aggregation Value</label>
            <select class="form-control" name="aggType" [(ngModel)]="config.aggregation.type">
              <option value="avg">Average (avg)</option>
              <option value="min">Minimum (min)</option>
              <option value="max">Maximum (max)</option>
            </select>
          </div>
          <div class="col-md-6 form-group">
            <label class="control-label" translate>Time Bucket Interval</label>
            <select class="form-control" name="aggInterval" [(ngModel)]="config.aggregation.interval">
              <option value="MINUTELY">Minutely</option>
              <option value="HOURLY">Hourly</option>
              <option value="DAILY">Daily</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Color Gradient Visualization Selection -->
      <div class="m-t-16 border-top p-t-16">
        <label style="font-weight: bold; display: block; margin-bottom: 12px;" translate>Time-Based Color Gradient</label>
        
        <div class="row" style="display: flex; gap: 16px;">
          <div class="col-md-6 form-group">
            <label class="control-label" translate>Start Color (Older points)</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input 
                type="color" 
                name="customStartColor" 
                [(ngModel)]="config.customStartColor" 
                (change)="onCustomColorsChange()"
                style="width: 48px; height: 36px; padding: 2px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;"
              />
              <span>{{ config.customStartColor }}</span>
            </div>
          </div>
          <div class="col-md-6 form-group">
            <label class="control-label" translate>End Color (Newer points)</label>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input 
                type="color" 
                name="customEndColor" 
                [(ngModel)]="config.customEndColor" 
                (change)="onCustomColorsChange()"
                style="width: 48px; height: 36px; padding: 2px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px;"
              />
              <span>{{ config.customEndColor }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <lib-scatter-plot-widget [config]="config"></lib-scatter-plot-widget>
    </ng-template>
  `
})
export class ScatterPlotWidgetConfigComponent implements OnInit {
  private _config: any = {};

  @Input()
  set config(val: any) {
    this._config = val || {};
    this.initDefaults();
  }
  get config(): any {
    return this._config;
  }

  datapointSelectorClass: any = null;

  private widgetConfigService = inject(WidgetConfigService);
  private alertService = inject(AlertService);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    // Dynamic import of Datapoint Selector Component class to prevent bundle issues
    import('@c8y/ngx-components/datapoint-selector').then(({ WidgetDatapointsSelectorComponent }) => {
      this.datapointSelectorClass = WidgetDatapointsSelectorComponent;
    });

    this.initDefaults();

    // Register before-save validation hook
    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      if (!currentConfig.datapointX || currentConfig.datapointX.length === 0) {
        this.alertService.warning('Please select an X-Axis Data Point.');
        return false;
      }
      if (!currentConfig.datapointY || currentConfig.datapointY.length === 0) {
        this.alertService.warning('Please select a Y-Axis Data Point.');
        return false;
      }
      return true;
    });
  }

  private initDefaults() {
    if (this._config) {
      if (!this._config.timeWindow) {
        this._config.timeWindow = 'lastHour';
      }
      if (!this._config.aggregation) {
        this._config.aggregation = {
          active: false,
          type: 'avg',
          interval: 'MINUTELY'
        };
      }
      if (!this._config.customStartColor) {
        this._config.customStartColor = '#3b82f6'; // Sleek blue
      }
      if (!this._config.customEndColor) {
        this._config.customEndColor = '#ef4444'; // Sleek red
      }
      // Always enforce gradientColors to match start/end pickers
      this._config.gradientColors = [this._config.customStartColor, this._config.customEndColor];
    }
  }

  onCustomColorsChange() {
    if (this._config) {
      this._config.gradientColors = [this._config.customStartColor, this._config.customEndColor];
    }
  }
}
