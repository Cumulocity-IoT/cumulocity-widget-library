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
import { AlertService, DynamicComponent, FormGroupComponent } from '@c8y/ngx-components';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { BehaviorSubject } from 'rxjs';
import { ParetoChartComponent } from './pareto-chart.component';

@Component({
  selector: 'c8y-pareto-chart-config',
  template: `
    <div [formGroup]="formGroup" class="p-16">

      <!-- Mode Selector -->
      <c8y-form-group>
        <label class="control-label">Analysis Mode</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="mode">
            <option value="alarms">Alarms Breakdown</option>
            <option value="events">Events Breakdown</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Timeframe selector -->
      <c8y-form-group>
        <label class="control-label">Time Frame</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="timeRange">
            <option value="lastHour">Last Hour</option>
            <option value="lastDay">Last Day</option>
            <option value="lastWeek">Last Week</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Analyse Children Checkbox -->
      <c8y-form-group>
        <label class="c8y-checkbox">
          <input type="checkbox" formControlName="analyseChildren" />
          <span></span>
          <span>Analyse children alarms/events instead of the asset itself</span>
        </label>
      </c8y-form-group>

      <!-- Group By selector (visible only when children analysis is checked) -->
      @if (formGroup.get('analyseChildren')?.value) {
        <c8y-form-group>
          <label class="control-label">Plot X-Axis By</label>
          <div class="c8y-select-wrapper">
            <select class="form-control" formControlName="groupBy">
              <option value="type">Alarm/Event Type</option>
              <option value="child">Child Device/Asset</option>
            </select>
          </div>
        </c8y-form-group>
      }

      <!-- Type Filter Mode -->
      <c8y-form-group>
        <label class="control-label">Type Filter Mode</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="typeFilterMode">
            <option value="none">No Filter (All Types)</option>
            <option value="whitelist">Whitelist (Only listed types)</option>
            <option value="blacklist">Blacklist (Ignore listed types)</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Types List (visible if whitelist or blacklist selected) -->
      @if (formGroup.get('typeFilterMode')?.value !== 'none') {
        <c8y-form-group>
          <label class="control-label">Types List</label>
          <input 
            class="form-control" 
            type="text" 
            formControlName="typesList" 
            placeholder="e.g. c8y_ThresholdAlarm, c8y_ConnectionAlarm" 
          />
          <small class="text-muted">Enter a comma-separated list of alarm/event types.</small>
        </c8y-form-group>
      }

    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <c8y-pareto-chart [config]="(config$ | async) || undefined"></c8y-pareto-chart>
    </ng-template>
  `,
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [CommonModule, FormGroupComponent, ReactiveFormsModule, ParetoChartComponent, AsyncPipe]
})
export class ParetoChartConfigComponent implements DynamicComponent, OnInit, OnChanges {
  @Input() config: any = {};

  formGroup!: FormGroup;
  config$ = new BehaviorSubject<any>(null);

  private alert = inject(AlertService);
  private widgetConfigService = inject(WidgetConfigService);
  private formBuilder = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    this.formGroup = this.formBuilder.group({
      mode: [this.config.mode || 'alarms', Validators.required],
      timeRange: [this.config.timeRange || 'lastWeek', Validators.required],
      analyseChildren: [this.config.analyseChildren || false],
      groupBy: [this.config.groupBy || 'type', Validators.required],
      typeFilterMode: [this.config.typeFilterMode || 'none', Validators.required],
      typesList: [this.config.typesList || '']
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
      if (this.formGroup.invalid) {
        this.alert.warning('Please fill out all required configuration options.');
        return false;
      }

      const formVal = this.formGroup.getRawValue();
      if (currentConfig) {
        Object.assign(currentConfig, formVal);
      }
      return true;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.formGroup) {
      const currentConf = changes['config'].currentValue || {};
      this.formGroup.patchValue({
        mode: currentConf.mode || 'alarms',
        timeRange: currentConf.timeRange || 'lastWeek',
        analyseChildren: currentConf.analyseChildren || false,
        groupBy: currentConf.groupBy || 'type',
        typeFilterMode: currentConf.typeFilterMode || 'none',
        typesList: currentConf.typesList || ''
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
