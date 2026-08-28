/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncPipe, CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlContainer,
  FormBuilder,
  FormGroup,
  NgForm,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { InventoryService } from '@c8y/client';
import {
  AlertService,
  CoreModule,
  DynamicComponent,
  FormGroupComponent,
  gettext
} from '@c8y/ngx-components';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { BehaviorSubject } from 'rxjs';
import { FleetStatisticsComponent } from './fleet-statistics.component';
import {
  buildInventoryQuery,
  DEFAULT_CUSTOM_COLORS,
  extractPropertyValue,
  FleetStatisticsConfig,
  PRESET_CONFIGURATIONS,
  QueryTestResult
} from './fleet-statistics.model';

@Component({
  selector: 'c8y-fleet-statistics-config',
  template: `
    <div [formGroup]="formGroup" class="p-16">
      
      <!-- Preset Quick Configuration -->
      <c8y-form-group>
        <label class="control-label" translate>Configuration Preset</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="preset" (change)="onPresetChange()">
            <option value="custom" translate>Custom Configuration</option>
            @for (preset of presets; track preset.id) {
              <option [value]="preset.id">{{ preset.label | translate }}</option>
            }
          </select>
        </div>
        <small class="text-muted" translate>Select a pre-built template or customize fields below.</small>
      </c8y-form-group>

      <!-- Target Scope Selector -->
      <c8y-form-group>
        <label class="control-label" translate>Target Scope</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="targetScope">
            <option value="devices" translate>Devices (has c8y_IsDevice)</option>
            <option value="assets" translate>Assets (has c8y_IsAsset)</option>
            <option value="all" translate>All Inventory Managed Objects</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- OData Filter Query -->
      <c8y-form-group>
        <label class="control-label" translate>OData Inventory Filter Query</label>
        <div class="input-group">
          <input 
            class="form-control" 
            type="text" 
            formControlName="queryFilter" 
            [placeholder]="queryFilterPlaceholder | translate"
          />
          <span class="input-group-btn">
            <button 
              type="button" 
              class="btn btn-default" 
              (click)="testCurrentQuery()" 
              [disabled]="isTestingQuery()"
              [title]="'Test query against inventory' | translate"
            >
              @if (isTestingQuery()) {
                <span class="spinner spinner-xs"></span>
              } @else {
                <i c8yIcon="play"></i>
              }
              {{ 'Test Query' | translate }}
            </button>
          </span>
        </div>
        <small class="text-muted" translate>
          Enter an optional OData query expression. Automatically combined with target scope.
        </small>
      </c8y-form-group>

      <!-- Query Test Results Banner -->
      @if (testResult()) {
        <div class="m-b-16 p-8 border-rounded" [ngClass]="testResult()?.errorMessage ? 'bg-danger-light text-danger' : 'bg-success-light text-success'">
          @if (testResult()?.errorMessage) {
            <div>
              <i c8yIcon="exclamation-triangle" class="m-r-4"></i>
              <strong>{{ 'Query Error' | translate }}:</strong> {{ testResult()?.errorMessage }}
            </div>
          } @else {
            <div>
              <i c8yIcon="check-circle" class="m-r-4"></i>
              <strong>{{ testResult()?.totalCount }}</strong> {{ 'objects matched across' | translate }}
              <strong>{{ testResult()?.distinctGroupsCount }}</strong> {{ 'groups' | translate }}.
              @if (testResult()?.sampleGroups?.length) {
                <div class="text-small m-t-4">
                  <em>{{ 'Samples' | translate }}:</em>
                  @for (sample of testResult()?.sampleGroups; track sample.name) {
                    <span class="badge badge-default m-r-4">{{ sample.name }}: {{ sample.count }}</span>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Group By Property Path -->
      <c8y-form-group>
        <label class="control-label" translate>Group By Property Path</label>
        <input 
          class="form-control" 
          type="text" 
          formControlName="groupByProperty" 
          [placeholder]="groupByPlaceholder | translate"
          required
        />
        <small class="text-muted" translate>
          Path inside managedObject. Supports dot notation (<code>c8y_Firmware.version</code>) and array predicates (<code>c8y_SoftwareList[name='Agent'].version</code>).
        </small>
      </c8y-form-group>

      <!-- Date Extraction Mode -->
      <c8y-form-group>
        <label class="control-label" translate>Date Extraction / Transformation</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="dateExtractionMode">
            <option value="none" translate>None (Use Raw Property Value)</option>
            <option value="year" translate>Year Only (YYYY) e.g. 2024</option>
            <option value="yearMonth" translate>Year & Month (YYYY-MM) e.g. 2024-08</option>
            <option value="date" translate>Full Date (YYYY-MM-DD) e.g. 2024-08-28</option>
          </select>
        </div>
        <small class="text-muted" translate>Useful when grouping by creationTime, deployment dates, or timestamp fields.</small>
      </c8y-form-group>

      <!-- Fallback Label -->
      <c8y-form-group>
        <label class="control-label" translate>Fallback Label for Missing Values</label>
        <input 
          class="form-control" 
          type="text" 
          formControlName="fallbackLabel" 
          [placeholder]="'e.g. Unknown, Not installed' | translate"
        />
      </c8y-form-group>

      <hr />
      <h4 class="text-medium m-b-16" translate>Chart Display Settings</h4>

      <!-- Chart Style: Donut vs Pie -->
      <div class="row">
        <div class="col-xs-6">
          <c8y-form-group>
            <label class="control-label" translate>Chart Style</label>
            <div class="c8y-select-wrapper">
              <select class="form-control" formControlName="chartStyle">
                <option value="donut" translate>Donut (Ring)</option>
                <option value="pie" translate>Classic Pie</option>
              </select>
            </div>
          </c8y-form-group>
        </div>

        <div class="col-xs-6">
          <c8y-form-group>
            <label class="control-label" translate>Max Slices to Display</label>
            <div class="c8y-select-wrapper">
              <select class="form-control" formControlName="maxSlices">
                <option [value]="5">5</option>
                <option [value]="10">10</option>
                <option [value]="15">15</option>
                <option [value]="20">20</option>
                <option [value]="50">50</option>
              </select>
            </div>
          </c8y-form-group>
        </div>
      </div>

      <!-- Group remaining into Other -->
      <c8y-form-group>
        <label class="c8y-checkbox">
          <input type="checkbox" formControlName="showOtherGroup" />
          <span></span>
          <span translate>Group remaining slices into "Other"</span>
        </label>
      </c8y-form-group>

      <div class="row">
        <div class="col-xs-6">
          <!-- Value Display Format -->
          <c8y-form-group>
            <label class="control-label" translate>Label Format</label>
            <div class="c8y-select-wrapper">
              <select class="form-control" formControlName="valueDisplay">
                <option value="both" translate>Count and Percentage</option>
                <option value="count" translate>Count Only</option>
                <option value="percentage" translate>Percentage Only</option>
              </select>
            </div>
          </c8y-form-group>
        </div>

        <div class="col-xs-6">
          <!-- Legend Position -->
          <c8y-form-group>
            <label class="control-label" translate>Legend</label>
            <div class="c8y-select-wrapper">
              <select class="form-control" formControlName="legendPosition">
                <option value="bottom" translate>Bottom</option>
                <option value="right" translate>Right Side</option>
                <option value="top" translate>Top</option>
                <option value="none" translate>Hidden</option>
              </select>
            </div>
          </c8y-form-group>
        </div>
      </div>

      <!-- Color Palette Configuration -->
      <c8y-form-group>
        <label class="control-label" translate>Color Palette</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="colorMode">
            <option value="automatic" translate>Brand Colors (Automatic)</option>
            <option value="custom" translate>Custom Colors</option>
          </select>
        </div>
        <small class="text-muted" translate>
          Automatically uses tints and shades of the primary brand color.
        </small>
      </c8y-form-group>

      <!-- Custom Color Palette Editor -->
      @if (formGroup.get('colorMode')?.value === 'custom') {
        <c8y-form-group>
          <label class="control-label" translate>Custom Slice Colors</label>
          <div class="custom-colors-grid">
            @for (color of customColors(); track $index) {
              <div class="custom-color-item">
                <input 
                  type="color" 
                  class="color-picker-input" 
                  [value]="color" 
                  (input)="updateColor($index, $any($event.target).value)" 
                />
                <input 
                  type="text" 
                  class="form-control input-sm color-hex-input" 
                  [value]="color" 
                  (change)="updateColor($index, $any($event.target).value)" 
                />
                @if (customColors().length > 2) {
                  <button 
                    type="button" 
                    class="btn btn-dot btn-danger delete-color-btn" 
                    (click)="removeColor($index)" 
                    [title]="'Remove color' | translate"
                  >
                    <i c8yIcon="trash-o"></i>
                  </button>
                }
              </div>
            }
          </div>
          <button 
            type="button" 
            class="btn btn-default btn-xs m-t-8" 
            (click)="addColor()"
          >
            <i c8yIcon="plus"></i> {{ 'Add Color' | translate }}
          </button>
        </c8y-form-group>
      }

    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <c8y-fleet-statistics [config]="(config$ | async) || undefined"></c8y-fleet-statistics>
    </ng-template>
  `,
  styles: [`
    .bg-success-light {
      background-color: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 4px;
    }
    .bg-danger-light {
      background-color: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 4px;
    }
    .spinner-xs {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776BF);
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .custom-colors-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px;
      margin-top: 6px;
    }
    .custom-color-item {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--c8y-card-background-default, rgba(0,0,0,0.02));
      border: 1px solid var(--c8y-root-component-border-color, #e2e8f0);
      border-radius: 4px;
      padding: 4px 6px;
    }
    .color-picker-input {
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      background: transparent;
    }
    .color-hex-input {
      font-family: monospace;
      font-size: 11px;
      height: 26px;
      padding: 2px 4px;
      flex: 1;
    }
    .delete-color-btn {
      padding: 2px 4px;
      font-size: 10px;
    }
  `],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [
    CommonModule,
    CoreModule,
    FormGroupComponent,
    ReactiveFormsModule,
    FleetStatisticsComponent,
    AsyncPipe
  ]
})
export class FleetStatisticsConfigComponent implements DynamicComponent, OnInit, OnChanges {
  @Input() config: FleetStatisticsConfig = {};

  formGroup!: FormGroup;
  config$ = new BehaviorSubject<FleetStatisticsConfig | null>(null);

  readonly queryFilterPlaceholder = "e.g. type eq 'c8y_Linux' or has(c8y_Firmware)";
  readonly groupByPlaceholder = 'e.g. c8y_Firmware.version, type, c8y_Hardware.model';

  isTestingQuery = signal<boolean>(false);
  testResult = signal<QueryTestResult | null>(null);
  customColors = signal<string[]>([]);

  readonly presets = PRESET_CONFIGURATIONS;

  private alert = inject(AlertService);
  private widgetConfigService = inject(WidgetConfigService);
  private formBuilder = inject(FormBuilder);
  private inventoryService = inject(InventoryService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    const initialColors = this.config.customColors && this.config.customColors.length > 0
      ? [...this.config.customColors]
      : [...DEFAULT_CUSTOM_COLORS];
    this.customColors.set(initialColors);

    this.formGroup = this.formBuilder.group({
      preset: ['custom'],
      targetScope: [this.config.targetScope || 'devices', Validators.required],
      queryFilter: [this.config.queryFilter || ''],
      groupByProperty: [this.config.groupByProperty || 'c8y_Firmware.version', Validators.required],
      dateExtractionMode: [this.config.dateExtractionMode || 'none'],
      fallbackLabel: [this.config.fallbackLabel || 'Unknown'],
      chartStyle: [this.config.chartStyle || 'donut'],
      maxSlices: [this.config.maxSlices || 10],
      showOtherGroup: [this.config.showOtherGroup !== false],
      valueDisplay: [this.config.valueDisplay || 'both'],
      legendPosition: [this.config.legendPosition || 'bottom'],
      colorMode: [this.config.colorMode || 'automatic']
    });

    this.emitPreview();

    this.formGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        Object.assign(this.config, val, { customColors: this.customColors() });
        this.emitPreview();
      });

    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      if (this.formGroup.invalid) {
        this.alert.warning(gettext('Please fill out all required configuration options.'));
        return false;
      }

      const formVal = this.formGroup.getRawValue();
      if (currentConfig) {
        Object.assign(currentConfig, formVal, { customColors: this.customColors() });
      }
      return true;
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && this.formGroup) {
      const currentConf = changes['config'].currentValue || {};
      const colors = currentConf.customColors && currentConf.customColors.length > 0
        ? [...currentConf.customColors]
        : [...DEFAULT_CUSTOM_COLORS];
      this.customColors.set(colors);

      this.formGroup.patchValue({
        targetScope: currentConf.targetScope || 'devices',
        queryFilter: currentConf.queryFilter || '',
        groupByProperty: currentConf.groupByProperty || 'c8y_Firmware.version',
        dateExtractionMode: currentConf.dateExtractionMode || 'none',
        fallbackLabel: currentConf.fallbackLabel || 'Unknown',
        chartStyle: currentConf.chartStyle || 'donut',
        maxSlices: currentConf.maxSlices || 10,
        showOtherGroup: currentConf.showOtherGroup !== false,
        valueDisplay: currentConf.valueDisplay || 'both',
        legendPosition: currentConf.legendPosition || 'bottom',
        colorMode: currentConf.colorMode || 'automatic'
      }, { emitEvent: false });
      
      this.emitPreview();
    }
  }

  addColor() {
    const current = this.customColors();
    const newColor = '#3b82f6';
    const updated = [...current, newColor];
    this.customColors.set(updated);
    this.config.customColors = updated;
    this.emitPreview();
  }

  removeColor(index: number) {
    const current = this.customColors();
    if (current.length <= 2) return;
    const updated = current.filter((_, i) => i !== index);
    this.customColors.set(updated);
    this.config.customColors = updated;
    this.emitPreview();
  }

  updateColor(index: number, newColor: string) {
    if (!newColor) return;
    const current = this.customColors();
    const updated = [...current];
    updated[index] = newColor;
    this.customColors.set(updated);
    this.config.customColors = updated;
    this.emitPreview();
  }

  onPresetChange() {
    const selectedPresetId = this.formGroup.get('preset')?.value;
    const foundPreset = this.presets.find(p => p.id === selectedPresetId);

    if (foundPreset) {
      this.formGroup.patchValue({
        targetScope: foundPreset.config.targetScope,
        queryFilter: foundPreset.config.queryFilter,
        groupByProperty: foundPreset.config.groupByProperty,
        dateExtractionMode: foundPreset.config.dateExtractionMode,
        fallbackLabel: foundPreset.config.fallbackLabel,
        chartStyle: foundPreset.config.chartStyle,
        maxSlices: foundPreset.config.maxSlices
      });
    }
  }

  async testCurrentQuery() {
    this.isTestingQuery.set(true);
    this.testResult.set(null);

    try {
      const formVal = this.formGroup.getRawValue();
      const query = buildInventoryQuery(formVal.targetScope, formVal.queryFilter);
      const groupByProp = formVal.groupByProperty || 'type';
      const dateExtractionMode = formVal.dateExtractionMode || 'none';
      const fallbackLabel = formVal.fallbackLabel || 'Unknown';

      const filter: any = {
        pageSize: 2000,
        withTotalPages: true
      };

      if (query) {
        filter.query = query;
      }

      const response = await this.inventoryService.list(filter);
      const items = response.data || [];

      const groupCounts = new Map<string, number>();
      for (const mo of items) {
        const extracted = extractPropertyValue(mo, groupByProp, dateExtractionMode, fallbackLabel);
        const values = Array.isArray(extracted) ? extracted : [extracted];
        for (const val of values) {
          const key = String(val || fallbackLabel);
          groupCounts.set(key, (groupCounts.get(key) || 0) + 1);
        }
      }

      const sampleGroups = Array.from(groupCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      this.testResult.set({
        totalCount: items.length,
        distinctGroupsCount: groupCounts.size,
        sampleGroups
      });
    } catch (err: any) {
      console.error('Test query failed:', err);
      const msg = err?.data?.message || err?.message || gettext('Query failed. Please check syntax.');
      this.testResult.set({
        totalCount: 0,
        distinctGroupsCount: 0,
        sampleGroups: [],
        errorMessage: msg
      });
    } finally {
      this.isTestingQuery.set(false);
    }
  }

  private emitPreview() {
    const rawVal = this.formGroup.getRawValue();
    const widgetConf: FleetStatisticsConfig = {
      ...rawVal,
      device: this.config.device
    };
    this.config$.next(widgetConf);
  }
}
