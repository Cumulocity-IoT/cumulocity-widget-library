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
import { TrendConfig } from './trend-analysis/trend.model';

@Component({
  selector: 'lib-spc-chart-widget-config',
  standalone: false,
  template: `
    <!-- Static Lines Section -->
    <div class="form-group">
      <label translate style="font-weight: bold; margin-bottom: 8px;">Static Lines</label>
      <div *ngIf="!config.staticLines || config.staticLines.length === 0" class="text-muted p-8" translate>
        No static lines added.
      </div>
      <div *ngFor="let line of config.staticLines; let i = index" class="row style-row m-b-8" style="display: flex; align-items: center;">
        <div class="col-md-5">
          <input type="number" class="form-control" [(ngModel)]="line.value" [placeholder]="'Value' | translate" name="line-value-{{i}}">
        </div>
        <div class="col-md-5">
          <input type="text" class="form-control" [(ngModel)]="line.label" [placeholder]="'Label' | translate" name="line-label-{{i}}">
        </div>
        <div class="col-md-2">
          <button type="button" class="btn btn-clean btn-xs text-danger" (click)="removeLine(i)">
            <i c8yIcon="delete"></i>
          </button>
        </div>
      </div>
      <button type="button" class="btn btn-default btn-xs" (click)="addLine()">
        <i c8yIcon="plus-circle"></i> {{ 'Add Line' | translate }}
      </button>
    </div>

    <hr />

    <!-- Areas Section -->
    <div class="form-group">
      <label translate style="font-weight: bold; margin-bottom: 8px;">Control Areas / Limits</label>
      <div *ngIf="!config.areas || config.areas.length === 0" class="text-muted p-8" translate>
        No control areas added.
      </div>
      <div *ngFor="let area of config.areas; let i = index" class="p-8 m-b-8 border-bottom" style="border: 1px solid var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.2)); border-radius: 4px; padding: 12px; margin-bottom: 12px;">
        <div class="row style-row" style="margin-bottom: 8px; display: flex; align-items: center;">
          <div class="col-md-4">
            <select class="form-control" [(ngModel)]="area.type" name="area-type-{{i}}">
              <option value="upper" translate>Upper Limit</option>
              <option value="lower" translate>Lower Limit</option>
              <option value="range" translate>Range</option>
            </select>
          </div>
          <div class="col-md-6">
            <input type="text" class="form-control" [(ngModel)]="area.label" [placeholder]="'Area Label' | translate" name="area-label-{{i}}">
          </div>
          <div class="col-md-2 text-right">
            <button type="button" class="btn btn-clean btn-xs text-danger" (click)="removeArea(i)">
              <i c8yIcon="delete"></i>
            </button>
          </div>
        </div>

        <div class="row style-row" style="display: flex; align-items: center;">
          <div class="col-md-4" *ngIf="area.type !== 'range'">
            <input type="number" class="form-control" [(ngModel)]="area.value" [placeholder]="'Threshold Value' | translate" name="area-val-{{i}}">
          </div>
          <div class="col-md-3" *ngIf="area.type === 'range'">
            <input type="number" class="form-control" [(ngModel)]="area.min" [placeholder]="'Min Value' | translate" name="area-min-{{i}}">
          </div>
          <div class="col-md-3" *ngIf="area.type === 'range'">
            <input type="number" class="form-control" [(ngModel)]="area.max" [placeholder]="'Max Value' | translate" name="area-max-{{i}}">
          </div>
          <div class="col-md-4">
            <div style="display: flex; align-items: center;">
              <input type="color" class="form-control-color" [(ngModel)]="area.color" name="area-color-{{i}}" style="width: 40px; height: 32px; padding: 2px; cursor: pointer; border: 1px solid var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.2)); border-radius: 4px; margin-right: 8px;">
              <span translate>Color</span>
            </div>
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-default btn-xs" (click)="addArea()">
        <i c8yIcon="plus-circle"></i> {{ 'Add Area' | translate }}
      </button>
    </div>

    <hr />

    <!-- Trend Analysis & Forecasting Section -->
    <div class="form-group">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <label translate style="font-weight: bold; margin-bottom: 0;">Trend Analysis & Forecasting</label>
        <label class="c8y-switch">
          <input type="checkbox" [(ngModel)]="config.trendConfig.enabled" name="trend-enabled">
          <span></span>
          <span translate>{{ config.trendConfig.enabled ? 'Enabled' : 'Disabled' }}</span>
        </label>
      </div>

      <div *ngIf="config.trendConfig?.enabled" style="border: 1px solid var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.2)); border-radius: 4px; padding: 14px; margin-top: 10px; background-color: var(--c8y-root-component-background-color, transparent);">
        
        <!-- Forecasting Method -->
        <div class="form-group">
          <label translate>Forecasting Method</label>
          <select class="form-control" [(ngModel)]="config.trendConfig.method" name="trend-method">
            <option value="holt" translate>Holt's Linear Exponential Smoothing (Adaptive)</option>
            <option value="linear" translate>Linear Regression (OLS)</option>
            <option value="polynomial" translate>Polynomial Regression (Non-Linear)</option>
            <option value="movingAverage" translate>Moving Average Velocity</option>
          </select>
        </div>

        <!-- Target Data Point (if multiple exist) -->
        <div class="form-group" *ngIf="config.datapoints && config.datapoints.length > 1">
          <label translate>Target Data Point</label>
          <select class="form-control" [(ngModel)]="config.trendConfig.targetDatapointIndex" name="trend-target-dp">
            <option *ngFor="let dp of config.datapoints; let dpIdx = index" [ngValue]="dpIdx">
              {{ dp.label || (dp.fragment + '.' + dp.series) }}
            </option>
          </select>
        </div>

        <!-- Forecast Horizon -->
        <div class="form-group">
          <label translate>Future Forecast Horizon</label>
          <div class="row style-row">
            <div class="col-md-6" style="padding-left: 0;">
              <input type="number" min="1" class="form-control" [(ngModel)]="config.trendConfig.forecastDuration" [placeholder]="'Duration' | translate" name="trend-duration">
            </div>
            <div class="col-md-6" style="padding-right: 0;">
              <select class="form-control" [(ngModel)]="config.trendConfig.forecastUnit" name="trend-unit">
                <option value="minutes" translate>Minutes</option>
                <option value="hours" translate>Hours</option>
                <option value="days" translate>Days</option>
                <option value="weeks" translate>Weeks</option>
                <option value="months" translate>Months</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Historical Training Window -->
        <div class="form-group">
          <label translate>Historical Training Scope</label>
          <select class="form-control" [(ngModel)]="config.trendConfig.trainingWindow" name="trend-window">
            <option value="all" translate>All visible historical data</option>
            <option value="last_n_points" translate>Last N data points</option>
            <option value="last_percentage" translate>Last % of visible time range</option>
          </select>

          <div *ngIf="config.trendConfig.trainingWindow === 'last_n_points'" style="margin-top: 8px;">
            <input type="number" min="2" class="form-control" [(ngModel)]="config.trendConfig.lastPointsCount" [placeholder]="'Number of points (e.g. 50)' | translate" name="trend-points-count">
          </div>

          <div *ngIf="config.trendConfig.trainingWindow === 'last_percentage'" style="margin-top: 8px;">
            <div class="input-group">
              <input type="number" min="1" max="100" class="form-control" [(ngModel)]="config.trendConfig.lastPercentage" [placeholder]="'Percentage' | translate" name="trend-percentage">
              <span class="input-group-addon">%</span>
            </div>
          </div>
        </div>

        <!-- Method-Specific Fine Tuning -->
        <!-- Holt's Exponential Smoothing Parameters -->
        <div *ngIf="config.trendConfig.method === 'holt'" class="p-8 m-b-8" style="background: rgba(128, 128, 128, 0.05); border-radius: 4px; padding: 10px;">
          <label style="font-weight: bold; margin-bottom: 8px;" translate>Holt Smoothing Parameters</label>
          <div class="form-group">
            <label>{{ 'Level Smoothing (&alpha;)' | translate }}: {{ config.trendConfig.holtAlpha }}</label>
            <input type="range" class="form-control" min="0.01" max="1.0" step="0.05" [(ngModel)]="config.trendConfig.holtAlpha" name="trend-holt-alpha">
            <span class="help-block text-muted" translate>Higher &alpha; adapts faster to recent value levels.</span>
          </div>

          <div class="form-group">
            <label>{{ 'Trend Smoothing (&beta;)' | translate }}: {{ config.trendConfig.holtBeta }}</label>
            <input type="range" class="form-control" min="0.01" max="1.0" step="0.05" [(ngModel)]="config.trendConfig.holtBeta" name="trend-holt-beta">
            <span class="help-block text-muted" translate>Higher &beta; adapts faster to recent slope changes.</span>
          </div>

          <div class="form-group m-b-0">
            <label>{{ 'Damping Factor (&phi;)' | translate }}: {{ config.trendConfig.holtDamping }}</label>
            <input type="range" class="form-control" min="0.8" max="1.0" step="0.02" [(ngModel)]="config.trendConfig.holtDamping" name="trend-holt-damping">
            <span class="help-block text-muted" translate>Dampens trend to prevent unrealistic long-term linear runaway.</span>
          </div>
        </div>

        <!-- Polynomial Degree Parameter -->
        <div *ngIf="config.trendConfig.method === 'polynomial'" class="form-group">
          <label translate>Polynomial Degree</label>
          <select class="form-control" [(ngModel)]="config.trendConfig.polynomialDegree" name="trend-poly-degree">
            <option [ngValue]="2" translate>Degree 2 (Quadratic curve)</option>
            <option [ngValue]="3" translate>Degree 3 (Cubic curve)</option>
          </select>
        </div>

        <!-- Moving Average Window Size Parameter -->
        <div *ngIf="config.trendConfig.method === 'movingAverage'" class="form-group">
          <label translate>Moving Average Window Size (Points)</label>
          <input type="number" min="2" max="200" class="form-control" [(ngModel)]="config.trendConfig.movingAverageWindow" [placeholder]="'Window Size (e.g. 10)' | translate" name="trend-ma-window">
        </div>

        <!-- Visual Customization -->
        <div class="form-group m-t-8">
          <label style="font-weight: bold; margin-bottom: 8px;" translate>Visual Presentation</label>
          <div class="row style-row" style="display: flex; align-items: center; margin-bottom: 8px;">
            <div class="col-md-4">
              <div style="display: flex; align-items: center;">
                <input type="color" class="form-control-color" [(ngModel)]="config.trendConfig.color" name="trend-color" style="width: 40px; height: 32px; padding: 2px; cursor: pointer; border: 1px solid var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.2)); border-radius: 4px; margin-right: 8px;">
                <span translate>Trend Color</span>
              </div>
            </div>
            <div class="col-md-4">
              <select class="form-control" [(ngModel)]="config.trendConfig.lineStyle" name="trend-linestyle">
                <option value="dashed" translate>Dashed</option>
                <option value="dotted" translate>Dotted</option>
                <option value="solid" translate>Solid</option>
              </select>
            </div>
            <div class="col-md-4">
              <select class="form-control" [(ngModel)]="config.trendConfig.lineWidth" name="trend-linewidth">
                <option [ngValue]="1">1 px</option>
                <option [ngValue]="2">2 px</option>
                <option [ngValue]="3">3 px</option>
                <option [ngValue]="4">4 px</option>
              </select>
            </div>
          </div>

          <div class="form-group m-t-8 m-b-0">
            <label class="c8y-checkbox">
              <input type="checkbox" [(ngModel)]="config.trendConfig.showConfidenceBand" name="trend-confidence-band">
              <span></span>
              <span translate>Show Confidence / Uncertainty Band</span>
            </label>
          </div>
        </div>

      </div>
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
    if (!this.config.trendConfig) {
      this.config.trendConfig = this.getDefaultTrendConfig();
    }
  }

  private getDefaultTrendConfig(): TrendConfig {
    return {
      enabled: false,
      method: 'holt',
      forecastDuration: 2,
      forecastUnit: 'hours',
      trainingWindow: 'all',
      lastPointsCount: 50,
      lastPercentage: 50,
      holtAlpha: 0.3,
      holtBeta: 0.1,
      holtDamping: 1.0,
      polynomialDegree: 2,
      movingAverageWindow: 10,
      color: '#FF7F0E',
      lineStyle: 'dashed',
      lineWidth: 2,
      showConfidenceBand: true,
      confidenceBandOpacity: 0.15,
      targetDatapointIndex: 0
    };
  }

  addLine() {
    this.config.staticLines.push({ value: 0, label: '' });
  }

  removeLine(index: number) {
    this.config.staticLines.splice(index, 1);
  }

  addArea() {
    this.config.areas.push({ type: 'upper', value: 0, min: 0, max: 0, label: '', color: '#E51A1A' });
  }

  removeArea(index: number) {
    this.config.areas.splice(index, 1);
  }
}
