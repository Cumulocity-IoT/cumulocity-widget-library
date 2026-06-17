/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlContainer,
  FormArray,
  FormBuilder,
  FormGroup,
  NgForm,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import {
  AlertService,
  DynamicComponent,
  FormGroupComponent
} from '@c8y/ngx-components';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { BehaviorSubject } from 'rxjs';
import { AlarmHeatmapComponent } from './alarm-heatmap.component';
import { WidgetConfig, HeatLevel } from './widget-config.model';

@Component({
  selector: 'c8y-alarm-heatmap-config',
  template: `
    <div [formGroup]="formGroup" class="p-16">
      
      <!-- Timeframe configuration -->
      <c8y-form-group>
        <label class="control-label">Time Range</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="timeRange">
            <option value="last24h">Last 24 Hours</option>
            <option value="lastWeek">Last Week</option>
            <option value="lastMonth">Last Month</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </c8y-form-group>

      @if (formGroup.get('timeRange')?.value === 'custom') {
        <div class="row">
          <div class="col-sm-6">
            <c8y-form-group>
              <label class="control-label">From</label>
              <input class="form-control" type="datetime-local" formControlName="customFrom" />
            </c8y-form-group>
          </div>
          <div class="col-sm-6">
            <c8y-form-group>
              <label class="control-label">To</label>
              <input class="form-control" type="datetime-local" formControlName="customTo" />
            </c8y-form-group>
          </div>
        </div>
      }

      <!-- Aggregation Settings -->
      <c8y-form-group>
        <label class="control-label">Aggregation Level</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="aggregationLevel">
            <option value="hourly">Every Hour</option>
            <option value="2h">Every 2 Hours</option>
            <option value="4h">Every 4 Hours</option>
            <option value="6h">Every 6 Hours</option>
            <option value="daily">Every Day</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- 5 Heat Levels Configuration with Strict Gap & Overlap Validations -->
      <div class="m-t-24">
        <h5 class="text-medium m-b-12">Configure Heat Levels (5 levels, open-ended)</h5>
        
        <div formArrayName="heatLevels">
          @for (levelGroup of heatLevelsArray.controls; track $index) {
            <div [formGroupName]="$index" class="row m-b-8 align-items-center">
              <div class="col-xs-2">
                <span class="badge" [style.background-color]="levelGroup.get('color')?.value" style="color: #000; padding: 6px 12px; border: 1px solid #ccc;">
                  Level {{ $index + 1 }}
                </span>
              </div>
              <div class="col-xs-4">
                <div class="input-group">
                  <span class="input-group-addon">Min</span>
                  <input class="form-control" type="number" formControlName="min" />
                </div>
              </div>
              <div class="col-xs-4">
                <div class="input-group">
                  <span class="input-group-addon">Max</span>
                  <input class="form-control" type="number" formControlName="max" [placeholder]="$index === 4 ? 'Open-ended' : 'Max limit'" />
                </div>
              </div>
              <div class="col-xs-2">
                <input type="color" formControlName="color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
              </div>
            </div>
          }
        </div>
      </div>

    </div>

    <!-- Interactive Live Preview Template -->
    <ng-template #widgetPreview>
      <c8y-alarm-heatmap [config]="(config$ | async) || undefined"></c8y-alarm-heatmap>
    </ng-template>
  `,
  styles: [`
    .color-picker {
      cursor: pointer;
    }
  `],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [CommonModule, FormGroupComponent, ReactiveFormsModule, AlarmHeatmapComponent, AsyncPipe]
})
export class AlarmHeatmapConfigComponent implements DynamicComponent, OnInit {
  @Input() config: WidgetConfig = {};

  formGroup!: FormGroup;
  config$ = new BehaviorSubject<WidgetConfig | null>(null);

  private alert = inject(AlertService);
  private widgetConfigService = inject(WidgetConfigService);
  private formBuilder = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  get heatLevelsArray() {
    return this.formGroup.get('heatLevels') as FormArray;
  }

  // Pre-loaded default palette to give a beautiful aesthetic out of the box
  defaultLevels: HeatLevel[] = [
    { min: 0, max: 0, color: '#FFFFFF' },
    { min: 1, max: 2, color: '#FEE2E2' },
    { min: 3, max: 5, color: '#FCA5A5' },
    { min: 6, max: 10, color: '#EF4444' },
    { min: 11, max: null, color: '#991B1B' }
  ];

  ngOnInit() {
    const existingLevels = this.config.heatLevels && this.config.heatLevels.length === 5 
      ? this.config.heatLevels 
      : this.defaultLevels;

    this.formGroup = this.formBuilder.group({
      timeRange: [this.config.timeRange || 'lastWeek', Validators.required],
      customFrom: [this.config.customFrom || ''],
      customTo: [this.config.customTo || ''],
      aggregationLevel: [this.config.aggregationLevel || 'hourly', Validators.required],
      heatLevels: this.formBuilder.array(
        existingLevels.map(level => this.formBuilder.group({
          min: [level.min, [Validators.required, Validators.min(0)]],
          max: [level.max], // null allowed for open ended (Level 5)
          color: [level.color, Validators.required]
        }))
      )
    });

    // Make last level's max disabled or null
    const lastLevel = this.heatLevelsArray.at(4);
    lastLevel.get('max')?.setValue(null);
    lastLevel.get('max')?.disable();

    // Trigger update preview
    this.emitPreview();

    this.formGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.emitPreview();
      });

    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      if (this.formGroup.invalid) {
        this.alert.warning('Please enter valid widget configuration options.');
        return false;
      }

      const formVal = this.formGroup.getRawValue();

      // Perform validation for contiguous ranges
      if (!this.validateThresholds(formVal.heatLevels)) {
        return false;
      }

      // Map back into Cumulocity WidgetConfig scheme
      if (currentConfig) {
        Object.assign(currentConfig, {
          timeRange: formVal.timeRange,
          customFrom: formVal.customFrom,
          customTo: formVal.customTo,
          aggregationLevel: formVal.aggregationLevel,
          heatLevels: formVal.heatLevels
        });
      }

      return true;
    });
  }

  private emitPreview() {
    const rawVal = this.formGroup.getRawValue();
    const widgetConf: WidgetConfig = {
      device: this.config.device, // preserve parent selected asset/device context
      timeRange: rawVal.timeRange,
      customFrom: rawVal.customFrom,
      customTo: rawVal.customTo,
      aggregationLevel: rawVal.aggregationLevel,
      heatLevels: rawVal.heatLevels
    };
    this.config$.next(widgetConf);
  }

  private validateThresholds(levels: HeatLevel[]): boolean {
    // 1. Min/Max logical consistency
    for (let i = 0; i < levels.length; i++) {
      const minVal = Number(levels[i].min);
      const maxVal = levels[i].max !== null ? Number(levels[i].max) : null;

      if (maxVal !== null && minVal > maxVal) {
        this.alert.danger(`Level ${i + 1} has a minimum higher than its maximum threshold.`);
        return false;
      }
    }

    // 2. Contiguity, gap, and overlap validation
    for (let i = 0; i < levels.length - 1; i++) {
      const currentMax = levels[i].max;
      const nextMin = levels[i + 1].min;

      if (currentMax === null) {
        this.alert.danger(`Level ${i + 1} cannot be open ended because it is not the final level.`);
        return false;
      }

      if (nextMin !== currentMax + 1) {
        this.alert.danger(
          `Gaps or overlaps detected between Level ${i + 1} and Level ${i + 2}. Level ${i + 2}'s Min (${nextMin}) must be exactly one increment above Level ${i + 1}'s Max (${currentMax}).`
        );
        return false;
      }
    }

    // 3. Confirm final level is indeed open ended
    if (levels[4].max !== null) {
      this.alert.danger('The final heat level (Level 5) must be open-ended.');
      return false;
    }

    return true;
  }
}
