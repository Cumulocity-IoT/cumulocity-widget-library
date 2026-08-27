/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, OnChanges, SimpleChanges, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlContainer,
  FormBuilder,
  FormGroup,
  NgForm,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { AlertService, DynamicComponent, FormGroupComponent, gettext, CoreModule } from '@c8y/ngx-components';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { DatapointSelectorService } from '@c8y/ngx-components/datapoint-selector';
import { BehaviorSubject } from 'rxjs';
import { SankeyDiagramComponent } from './sankey-diagram.component';

@Component({
  selector: 'c8y-sankey-diagram-config',
  template: `
    <div [formGroup]="formGroup" class="p-16">

      <!-- Mode Selector -->
      <c8y-form-group>
        <label class="control-label" translate>Analysis Mode</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="mode">
            <option value="alarms" translate>Alarms Breakdown</option>
            <option value="events" translate>Events Breakdown</option>
            <option value="measurements" translate>Measurements Breakdown</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Event/Alarm Type Input (Alarms or Events mode) -->
      @if (formGroup.get('mode')?.value === 'alarms' || formGroup.get('mode')?.value === 'events') {
        <c8y-form-group>
          <label class="control-label" translate>Event or Alarm Type</label>
          <input 
            class="form-control" 
            type="text" 
            formControlName="typeFilter" 
            [placeholder]="'e.g. c8y_ThresholdAlarm (Leave empty for all)' | translate" 
          />
          <small class="text-muted" translate>Enter the exact type string to filter by, or leave blank to count all types.</small>
        </c8y-form-group>
      }

      <!-- Measurement Configuration (Measurements mode) -->
      @if (formGroup.get('mode')?.value === 'measurements') {
        <div class="m-b-16">
          <label class="control-label" translate>Target Measurement</label>

          @if (formGroup.get('fragment')?.value && formGroup.get('series')?.value) {
            <!-- Selected Data Point Card -->
            <div class="card p-12 bg-level-1 m-b-12" style="border: 1px solid var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.2)); border-radius: 4px;">
              <div class="d-flex j-c-between a-i-center">
                <div style="flex: 1; min-width: 0;">
                  <div class="text-bold text-truncate" style="font-size: 14px;">
                    <i c8yIcon="sliders" class="text-primary m-r-4"></i>
                    {{ formGroup.get('measurementLabel')?.value || formGroup.get('series')?.value }}
                  </div>
                  <div class="text-muted text-small m-t-4">
                    <code>{{ formGroup.get('fragment')?.value }}.{{ formGroup.get('series')?.value }}</code>
                    @if (formGroup.get('unit')?.value) {
                      <span class="badge badge-info m-l-8">{{ formGroup.get('unit')?.value }}</span>
                    }
                  </div>
                </div>
                <button 
                  type="button" 
                  class="btn btn-default btn-sm m-l-8"
                  (click)="openDatapointModal()"
                  [title]="'Change data point' | translate"
                >
                  <i c8yIcon="pencil"></i> {{ 'Change' | translate }}
                </button>
              </div>
            </div>
          } @else {
            <!-- No Selection Placeholder -->
            <div class="p-16 bg-level-1 text-center m-b-12" style="border: 1px dashed var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.3)); border-radius: 4px;">
              <i c8yIcon="sliders" class="text-muted text-large m-b-8"></i>
              <p class="text-muted text-small m-b-12">{{ 'No measurement data point selected. Browse and select a data point to analyze.' | translate }}</p>
              <button 
                type="button" 
                class="btn btn-primary btn-sm"
                (click)="openDatapointModal()"
              >
                <i c8yIcon="search"></i> {{ 'Browse Data Points' | translate }}
              </button>
            </div>
          }

          <!-- Aggregation and Decimal Settings -->
          <div class="row">
            <div class="col-xs-8">
              <c8y-form-group>
                <label class="control-label" translate>Measurement Aggregation</label>
                <div class="c8y-select-wrapper">
                  <select class="form-control" formControlName="measurementAggregation">
                    <option value="sum" translate>Sum over timeframe (Total)</option>
                    <option value="latest" translate>Latest value (Snapshot / Current)</option>
                    <option value="delta" translate>Delta / Consumption (Latest - Oldest)</option>
                    <option value="avg" translate>Average over timeframe</option>
                    <option value="max" translate>Maximum value</option>
                    <option value="min" translate>Minimum value</option>
                  </select>
                </div>
                <small class="text-muted" translate>
                  Defines how readings for each device are calculated before rolling up the hierarchy.
                </small>
              </c8y-form-group>
            </div>
            <div class="col-xs-4">
              <c8y-form-group>
                <label class="control-label" translate>Decimals</label>
                <input 
                  class="form-control" 
                  type="number" 
                  formControlName="decimalPlaces" 
                  min="0" 
                  max="5"
                />
              </c8y-form-group>
            </div>
          </div>
        </div>
      }

      <!-- Timeframe selector -->
      <c8y-form-group>
        <label class="control-label" translate>Time Frame</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="timeRange">
            <option value="lastHour" translate>Last Hour</option>
            <option value="lastDay" translate>Last Day</option>
            <option value="lastWeek" translate>Last Week</option>
            <option value="lastMonth" translate>Last Month</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Depth of search -->
      <c8y-form-group>
        <label class="control-label" translate>Hierarchy Search Depth</label>
        <input 
          class="form-control" 
          type="number" 
          formControlName="searchDepth" 
          min="1" 
          max="5"
        />
        <small class="text-muted" translate>Depth of children search (1: immediate children, 2: children + grandchildren, etc. Max 5)</small>
      </c8y-form-group>

      <!-- Color configuration -->
      <div class="m-t-24">
        <h5 class="text-medium m-b-12" translate>Configure Layer Colors</h5>
        
        <!-- Level 0 (Root) -->
        <div class="row m-b-8 align-items-center">
          <div class="col-xs-8">
            <label class="control-label m-0" translate>Root Asset Color (Level 0)</label>
          </div>
          <div class="col-xs-4">
            <input type="color" formControlName="level0Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
          </div>
        </div>

        <!-- Level 1 -->
        <div class="row m-b-8 align-items-center">
          <div class="col-xs-8">
            <label class="control-label m-0" translate>Children Color (Level 1)</label>
          </div>
          <div class="col-xs-4">
            <input type="color" formControlName="level1Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
          </div>
        </div>

        <!-- Level 2 -->
        @if (formGroup.get('searchDepth')?.value >= 2) {
          <div class="row m-b-8 align-items-center">
            <div class="col-xs-8">
              <label class="control-label m-0" translate>Grandchildren Color (Level 2)</label>
            </div>
            <div class="col-xs-4">
              <input type="color" formControlName="level2Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
            </div>
          </div>
        }

        <!-- Level 3 -->
        @if (formGroup.get('searchDepth')?.value >= 3) {
          <div class="row m-b-8 align-items-center">
            <div class="col-xs-8">
              <label class="control-label m-0" translate>Level 3 Color</label>
            </div>
            <div class="col-xs-4">
              <input type="color" formControlName="level3Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
            </div>
          </div>
        }

        <!-- Level 4 -->
        @if (formGroup.get('searchDepth')?.value >= 4) {
          <div class="row m-b-8 align-items-center">
            <div class="col-xs-8">
              <label class="control-label m-0" translate>Level 4 Color</label>
            </div>
            <div class="col-xs-4">
              <input type="color" formControlName="level4Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
            </div>
          </div>
        }

        <!-- Level 5 -->
        @if (formGroup.get('searchDepth')?.value >= 5) {
          <div class="row m-b-8 align-items-center">
            <div class="col-xs-8">
              <label class="control-label m-0" translate>Level 5 Color</label>
            </div>
            <div class="col-xs-4">
              <input type="color" formControlName="level5Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
            </div>
          </div>
        }

        <!-- Direct flow color -->
        <div class="row m-b-8 align-items-center m-t-16">
          <div class="col-xs-8">
            <label class="control-label m-0" translate>Direct Flows Color (Self)</label>
          </div>
          <div class="col-xs-4">
            <input type="color" formControlName="directColor" class="form-control color-picker" style="height: 34px; padding: 2px;" />
          </div>
        </div>
      </div>

    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <c8y-sankey-diagram [config]="(config$ | async) || undefined"></c8y-sankey-diagram>
    </ng-template>
  `,
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [CommonModule, CoreModule, FormGroupComponent, ReactiveFormsModule, SankeyDiagramComponent, AsyncPipe]
})
export class SankeyDiagramConfigComponent implements DynamicComponent, OnInit, OnChanges {
  @Input() config: any = {};

  formGroup!: FormGroup;
  config$ = new BehaviorSubject<any>(null);

  private alert = inject(AlertService);
  private widgetConfigService = inject(WidgetConfigService);
  private datapointSelectorService = inject(DatapointSelectorService, { optional: true });
  private formBuilder = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    this.formGroup = this.formBuilder.group({
      mode: [this.config.mode || 'alarms', Validators.required],
      typeFilter: [this.config.typeFilter || ''],
      fragment: [this.config.fragment || ''],
      series: [this.config.series || ''],
      unit: [this.config.unit || ''],
      measurementLabel: [this.config.measurementLabel || ''],
      measurementAggregation: [this.config.measurementAggregation || 'sum'],
      decimalPlaces: [this.config.decimalPlaces !== undefined ? this.config.decimalPlaces : 2, [Validators.min(0), Validators.max(5)]],
      timeRange: [this.config.timeRange || 'lastWeek', Validators.required],
      searchDepth: [this.config.searchDepth || 1, [Validators.required, Validators.min(1), Validators.max(5)]],
      level0Color: [this.config.level0Color || '#00A1F2'],
      level1Color: [this.config.level1Color || '#FF8800'],
      level2Color: [this.config.level2Color || '#119D11'],
      level3Color: [this.config.level3Color || '#FFBE00'],
      level4Color: [this.config.level4Color || '#E51A1A'],
      level5Color: [this.config.level5Color || '#006699'],
      directColor: [this.config.directColor || '#7E7E80']
    });

    this.emitPreview();

    // Mutate the local config reference on every form change
    this.formGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        Object.assign(this.config, val);
        this.emitPreview();
      });

    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      const mode = this.formGroup.get('mode')?.value;
      if (mode === 'measurements') {
        const fragment = this.formGroup.get('fragment')?.value?.trim();
        const series = this.formGroup.get('series')?.value?.trim();
        if (!fragment || !series) {
          this.alert.warning(gettext('Please select a measurement data point.'));
          return false;
        }
      }

      if (this.formGroup.invalid) {
        this.alert.warning(gettext('Please fill out all required configuration options.'));
        return false;
      }

      const formVal = this.formGroup.getRawValue();
      if (currentConfig) {
        Object.assign(currentConfig, formVal);
      }
      return true;
    });
  }

  async openDatapointModal() {
    if (!this.datapointSelectorService) {
      this.alert.warning(gettext('Data point selector service is not available.'));
      return;
    }

    try {
      const selected = await this.datapointSelectorService.selectDataPoints({
        finishWithFirstSelection: true,
        allowDatapointsFromMultipleAssets: true
      });

      if (selected && selected.length > 0) {
        const dp = selected[0];
        this.formGroup.patchValue({
          fragment: dp.fragment,
          series: dp.series,
          unit: dp.unit || '',
          measurementLabel: dp.label || dp.series || ''
        });
      }
    } catch (err) {
      // User cancelled modal
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.formGroup) {
      const currentConf = changes['config'].currentValue || {};
      this.formGroup.patchValue({
        mode: currentConf.mode || 'alarms',
        typeFilter: currentConf.typeFilter || '',
        fragment: currentConf.fragment || '',
        series: currentConf.series || '',
        unit: currentConf.unit || '',
        measurementLabel: currentConf.measurementLabel || '',
        measurementAggregation: currentConf.measurementAggregation || 'sum',
        decimalPlaces: currentConf.decimalPlaces !== undefined ? currentConf.decimalPlaces : 2,
        timeRange: currentConf.timeRange || 'lastWeek',
        searchDepth: currentConf.searchDepth || 1,
        level0Color: currentConf.level0Color || '#00A1F2',
        level1Color: currentConf.level1Color || '#FF8800',
        level2Color: currentConf.level2Color || '#119D11',
        level3Color: currentConf.level3Color || '#FFBE00',
        level4Color: currentConf.level4Color || '#E51A1A',
        level5Color: currentConf.level5Color || '#006699',
        directColor: currentConf.directColor || '#7E7E80'
      }, { emitEvent: false });
      
      this.emitPreview();
    }
  }

  private emitPreview() {
    const rawVal = this.formGroup.getRawValue();
    const widgetConf = {
      ...rawVal,
      device: this.config.device
    };
    this.config$.next(widgetConf);
  }
}
