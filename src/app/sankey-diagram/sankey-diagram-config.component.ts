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
import { SankeyDiagramComponent } from './sankey-diagram.component';

@Component({
  selector: 'c8y-sankey-diagram-config',
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

      <!-- Event/Alarm Type Input -->
      <c8y-form-group>
        <label class="control-label">Event or Alarm Type</label>
        <input 
          class="form-control" 
          type="text" 
          formControlName="typeFilter" 
          placeholder="e.g. c8y_ThresholdAlarm (Leave empty for all)" 
        />
        <small class="text-muted">Enter the exact type string to filter by, or leave blank to count all types.</small>
      </c8y-form-group>

      <!-- Timeframe selector -->
      <c8y-form-group>
        <label class="control-label">Time Frame</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="timeRange">
            <option value="lastHour">Last Hour</option>
            <option value="lastDay">Last Day</option>
            <option value="lastWeek">Last Week</option>
            <option value="lastMonth">Last Month</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Depth of search -->
      <c8y-form-group>
        <label class="control-label">Hierarchy Search Depth</label>
        <input 
          class="form-control" 
          type="number" 
          formControlName="searchDepth" 
          min="1" 
          max="5"
        />
        <small class="text-muted">Depth of children search (1: immediate children, 2: children + grandchildren, etc. Max 5)</small>
      </c8y-form-group>

      <!-- Color configuration -->
      <div class="m-t-24">
        <h5 class="text-medium m-b-12">Configure Layer Colors</h5>
        
        <!-- Level 0 (Root) -->
        <div class="row m-b-8 align-items-center">
          <div class="col-xs-8">
            <label class="control-label m-0">Root Asset Color (Level 0)</label>
          </div>
          <div class="col-xs-4">
            <input type="color" formControlName="level0Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
          </div>
        </div>

        <!-- Level 1 -->
        <div class="row m-b-8 align-items-center">
          <div class="col-xs-8">
            <label class="control-label m-0">Children Color (Level 1)</label>
          </div>
          <div class="col-xs-4">
            <input type="color" formControlName="level1Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
          </div>
        </div>

        <!-- Level 2 -->
        @if (formGroup.get('searchDepth')?.value >= 2) {
          <div class="row m-b-8 align-items-center">
            <div class="col-xs-8">
              <label class="control-label m-0">Grandchildren Color (Level 2)</label>
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
              <label class="control-label m-0">Level 3 Color</label>
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
              <label class="control-label m-0">Level 4 Color</label>
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
              <label class="control-label m-0">Level 5 Color</label>
            </div>
            <div class="col-xs-4">
              <input type="color" formControlName="level5Color" class="form-control color-picker" style="height: 34px; padding: 2px;" />
            </div>
          </div>
        }

        <!-- Direct flow color -->
        <div class="row m-b-8 align-items-center m-t-16">
          <div class="col-xs-8">
            <label class="control-label m-0">Direct Flows Color (Self)</label>
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
  imports: [CommonModule, FormGroupComponent, ReactiveFormsModule, SankeyDiagramComponent, AsyncPipe]
})
export class SankeyDiagramConfigComponent implements DynamicComponent, OnInit, OnChanges {
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
      typeFilter: [this.config.typeFilter || ''],
      timeRange: [this.config.timeRange || 'lastWeek', Validators.required],
      searchDepth: [this.config.searchDepth || 1, [Validators.required, Validators.min(1), Validators.max(5)]],
      level0Color: [this.config.level0Color || '#1776bf'],
      level1Color: [this.config.level1Color || '#f39c12'],
      level2Color: [this.config.level2Color || '#2ecc71'],
      level3Color: [this.config.level3Color || '#9b59b6'],
      level4Color: [this.config.level4Color || '#e74c3c'],
      level5Color: [this.config.level5Color || '#1abc9c'],
      directColor: [this.config.directColor || '#7f8c8d']
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
        typeFilter: currentConf.typeFilter || '',
        timeRange: currentConf.timeRange || 'lastWeek',
        searchDepth: currentConf.searchDepth || 1,
        level0Color: currentConf.level0Color || '#1776bf',
        level1Color: currentConf.level1Color || '#f39c12',
        level2Color: currentConf.level2Color || '#2ecc71',
        level3Color: currentConf.level3Color || '#9b59b6',
        level4Color: currentConf.level4Color || '#e74c3c',
        level5Color: currentConf.level5Color || '#1abc9c',
        directColor: currentConf.directColor || '#7f8c8d'
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
