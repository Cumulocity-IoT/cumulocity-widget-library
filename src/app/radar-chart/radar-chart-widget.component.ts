/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MeasurementService } from '@c8y/client';
import { DashboardChildComponent, WidgetTimeContextDateRangeService, MeasurementRealtimeService } from '@c8y/ngx-components';
import { AlarmSeverityToIconPipe, AlarmSeverityToLabelPipe } from '@c8y/ngx-components/alarms';
import { ChartAlarmsService, ChartEventsService, ChartHelpersService } from '@c8y/ngx-components/echart';
import {
  DisplayMode,
  GlobalContextState,
  GLOBAL_CONTEXT_DISPLAY_MODE,
  PRESET_NAME
} from '@c8y/ngx-components/global-context';
import { Subscription } from 'rxjs';

interface DeviceTelemetry {
  id: string;
  name: string;
  values: { [key: string]: number | null };
}

interface NormalizedPoint {
  x: number;
  y: number;
  val: number | null;
  isMissing: boolean;
}

@Component({
  selector: 'lib-radar-chart-widget',
  standalone: false,
  providers: [
    DatePipe,
    AlarmSeverityToIconPipe,
    AlarmSeverityToLabelPipe,
    WidgetTimeContextDateRangeService,
    ChartAlarmsService,
    ChartEventsService,
    ChartHelpersService,
    MeasurementRealtimeService
  ],
  template: `
    <div class="radar-widget-container" [class.no-table]="config?.showTable === false">
      <!-- Global Time Context Connector for Dashboard Mode -->
      <c8y-global-context-connector
        *ngIf="displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD"
        [controls]="PRESET_NAME.DEFAULT"
        [config]="contextConfig"
        [isLoading]="isLoading"
        [dashboardChild]="getDashboardChild()!"
        [linked]="isLinkedToGlobal"
        (configChange)="onContextChange($event)"
        (refresh)="onRefresh()"
      >
      </c8y-global-context-connector>

      <!-- Local Time Context Controls for Config / View & Config Modes -->
      <c8y-local-controls
        *ngIf="displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.VIEW_AND_CONFIG"
        [controls]="PRESET_NAME.DEFAULT"
        [displayMode]="displayMode"
        [config]="contextConfig"
        [isLoading]="isLoading"
        (configChange)="onContextChange($event)"
        (refresh)="onRefresh()"
      >
      </c8y-local-controls>

      <div class="radar-content">
        @if (isLoading) {
          <div class="state-container text-center p-24">
            <span class="spinner"></span>
            <p class="m-t-8 text-muted text-small">Loading telemetry data...</p>
          </div>
        } @else if (!config?.devices || config.devices.length === 0) {
          <div class="state-container text-center p-24">
            <i c8yIcon="hdd-o" class="text-muted text-large m-b-8"></i>
            <p class="text-muted">No devices selected. Please configure the widget.</p>
          </div>
        } @else if (!config?.datapoints || config.datapoints.length < 3) {
          <div class="state-container text-center p-24">
            <i c8yIcon="area-chart" class="text-muted text-large m-b-8"></i>
            <p class="text-muted">Please select at least 3 datapoints to render the radar chart.</p>
          </div>
        } @else {
          <!-- SVG Spider Chart -->
          <div class="chart-wrapper">
            <svg viewBox="0 0 400 400" width="100%" height="100%" class="radar-svg">
              <!-- Grid Levels -->
              @for (level of [0.25, 0.5, 0.75, 1.0]; track level) {
                <polygon 
                  [attr.points]="getGridPoints(level)" 
                  class="grid-polygon"
                />
              }

              <!-- Radial Axes and Labels -->
              @for (dp of config.datapoints; track dp.id || $index; let idx = $index) {
                <line 
                  [attr.x1]="200" 
                  [attr.y1]="200" 
                  [attr.x2]="getAxisEnd(idx).x" 
                  [attr.y2]="getAxisEnd(idx).y" 
                  class="axis-line"
                />
                <text 
                  [attr.x]="getAxisEnd(idx, 1.15).x" 
                  [attr.y]="getAxisEnd(idx, 1.15).y" 
                  [attr.text-anchor]="getTextAnchor(idx)"
                  class="axis-label"
                >
                  {{ dp.label }}
                </text>
              }

              <!-- Device Polygons / Paths -->
              @for (dev of deviceData; track dev.id; let devIdx = $index) {
                <!-- Transparent Filled Area (bypassing missing values) -->
                <polygon 
                  [attr.points]="getDevicePolygonPoints(dev, devIdx)" 
                  [attr.fill]="getDeviceColor(devIdx)" 
                  fill-opacity="0.15"
                  class="device-polygon"
                />

                <!-- Line segments (solid if normal, dashed if going to/from N/A) -->
                @for (seg of getDeviceSegments(dev, devIdx); track $index) {
                  <line 
                    [attr.x1]="seg.x1" 
                    [attr.y1]="seg.y1" 
                    [attr.x2]="seg.x2" 
                    [attr.y2]="seg.y2" 
                    [attr.stroke]="getDeviceColor(devIdx)" 
                    [attr.stroke-dasharray]="seg.isDashed ? '3,3' : 'none'" 
                    stroke-width="2.5"
                    class="device-segment"
                  />
                }

                <!-- Interactive Data points / N/A Markers -->
                @for (pt of getDevicePoints(dev, devIdx); track $index) {
                  @if (pt.isMissing) {
                    <!-- Cross/X marker for N/A -->
                    <g [attr.transform]="'translate(' + pt.x + ',' + pt.y + ')'" class="na-marker">
                      <circle r="4" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"></circle>
                      <line x1="-3" y1="-3" x2="3" y2="3" stroke="#e11d48" stroke-width="1.5"></line>
                      <line x1="3" y1="-3" x2="-3" y2="3" stroke="#e11d48" stroke-width="1.5"></line>
                    </g>
                  } @else {
                    <!-- Normal Value Dot -->
                    <circle 
                      [attr.cx]="pt.x" 
                      [attr.cy]="pt.y" 
                      r="4.5" 
                      [attr.fill]="getDeviceColor(devIdx)" 
                      stroke="#ffffff" 
                      stroke-width="1.5"
                      class="value-dot"
                    >
                      <title>{{ dev.name }} - {{ pt.val | number:'1.1-2' }}</title>
                    </circle>
                  }
                }
              }
            </svg>
          </div>

          <!-- Tabular Details and Missing Data Legend -->
          @if (config.showTable !== false) {
            <div class="table-container m-t-16">
              <table class="table table-striped table-hover c8y-table">
                <thead>
                  <tr>
                    <th>Device / Asset</th>
                    @for (dp of config.datapoints; track dp.id || $index) {
                      <th>{{ dp.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (dev of deviceData; track dev.id; let devIdx = $index) {
                    <tr>
                      <td class="font-medium" style="white-space: nowrap;">
                        <span class="device-badge" [style.background-color]="getDeviceColor(devIdx)"></span>
                        {{ dev.name }}
                      </td>
                      @for (dp of config.datapoints; track dp.id || $index) {
                        <td>
                          @if (dev.values[getDpKey(dp)] !== null) {
                            {{ dev.values[getDpKey(dp)] | number:'1.1-2' }} <span class="text-muted text-small">{{ dp.unit }}</span>
                          } @else {
                            <span class="text-danger font-medium"><i c8yIcon="exclamation-triangle"></i> N/A</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .radar-widget-container {
      font-family: 'Outfit', 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      background: #ffffff;
    }
    .radar-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow-y: auto;
      padding: 12px;
    }
    .state-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    .chart-wrapper {
      flex: 1;
      min-height: 280px;
      max-height: 400px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .no-table .chart-wrapper {
      max-height: none;
      height: 100%;
    }
    .radar-svg {
      max-width: 100%;
      max-height: 100%;
    }
    .grid-polygon {
      fill: none;
      stroke: #e2e8f0;
      stroke-width: 1;
    }
    .axis-line {
      stroke: #cbd5e1;
      stroke-width: 1;
      stroke-dasharray: 2,2;
    }
    .axis-label {
      font-size: 10px;
      fill: #475569;
      font-weight: 500;
    }
    
    /* SVG Element Transitions for Smooth Telemetry Animation */
    .value-dot {
      cursor: pointer;
      transition: cx 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                  cy 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                  r 0.2s ease;
    }
    .value-dot:hover {
      r: 6.5;
    }
    .device-segment {
      transition: x1 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                  y1 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                  x2 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                  y2 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .device-polygon {
      transition: points 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    .na-marker {
      transition: transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1);
    }

    .device-badge {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
    }
    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 2px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776BF);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .table-container {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .c8y-table {
      margin-bottom: 0;
      font-size: 11px;
    }
    .c8y-table th {
      background: #f8fafc;
      color: #334155;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 10;
    }
  `]
})
export class RadarChartWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() config: any;

  private measurementService = inject(MeasurementService);
  private measurementRealtime = inject(MeasurementRealtimeService);
  private dashboardChild = inject(DashboardChildComponent, { optional: true });
  private changeRef = inject(ChangeDetectorRef);

  displayMode: DisplayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
  readonly GLOBAL_CONTEXT_DISPLAY_MODE = GLOBAL_CONTEXT_DISPLAY_MODE;
  readonly PRESET_NAME = PRESET_NAME;

  contextConfig: GlobalContextState = {};
  isLoading = false;
  isLinkedToGlobal = true;

  deviceData: DeviceTelemetry[] = [];
  deviceColors = [
    '#1776bf', // Blue
    '#25b875', // Green
    '#e67e22', // Orange
    '#9b59b6', // Purple
    '#e74c3c'  // Red
  ];

  // SVG Center and Max Radius
  cx = 200;
  cy = 200;
  r = 130;

  private realtimeSubscriptions: Subscription[] = [];
  private subscribedDeviceIds: string[] = [];

  ngOnInit() {
    this.initContext();
    // Removed duplicate fetchData() call to prevent double initialization alongside ngOnChanges
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && changes['config'].currentValue) {
      const prev = changes['config'].previousValue;
      const curr = changes['config'].currentValue;

      const hasDeviceChanges = JSON.stringify(prev?.devices) !== JSON.stringify(curr?.devices);
      const hasDatapointChanges = JSON.stringify(prev?.datapoints) !== JSON.stringify(curr?.datapoints);
      const hasModeChanges = prev?.valueMode !== curr?.valueMode;

      if (hasDeviceChanges || hasDatapointChanges || hasModeChanges || !prev) {
        this.initContext(curr);
        this.fetchData();
      }
    }
  }

  ngOnDestroy() {
    this.clearRealtimeSubscriptions();
  }

  private initContext(config = this.config) {
    const {
      displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD,
      dateTimeContext,
      aggregation,
      isAutoRefreshEnabled,
      refreshInterval,
      refreshOption
    } = config || {};

    this.displayMode = displayMode as DisplayMode;

    const hasDashboardChildData = this.dashboardChild && this.dashboardChild.data && this.dashboardChild.data.id;
    if (this.displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD && !hasDashboardChildData) {
      this.displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
    }

    this.isLinkedToGlobal = true;

    this.contextConfig = {
      dateTimeContext,
      aggregation,
      isAutoRefreshEnabled,
      refreshInterval,
      refreshOption
    };
  }

  onContextChange(event: any): void {
    const newContext = event?.context || event || {};
    
    // Strict comparison check to break infinite reference loops from c8y-global-context-connector
    let hasChanged = false;

    if (newContext.refreshOption === 'live') {
      // In live/realtime mode, ignore sliding date boundary shifts
      hasChanged = 
        this.contextConfig.refreshOption !== 'live' ||
        newContext.aggregation !== this.contextConfig.aggregation ||
        (event && typeof event.linked === 'boolean' && event.linked !== this.isLinkedToGlobal);
    } else {
      // In historical mode, changes in date range should trigger a re-fetch
      hasChanged = 
        newContext.dateTimeContext?.dateFrom !== this.contextConfig.dateTimeContext?.dateFrom ||
        newContext.dateTimeContext?.dateTo !== this.contextConfig.dateTimeContext?.dateTo ||
        newContext.aggregation !== this.contextConfig.aggregation ||
        newContext.refreshOption !== this.contextConfig.refreshOption ||
        (event && typeof event.linked === 'boolean' && event.linked !== this.isLinkedToGlobal);
    }

    if (!hasChanged && this.deviceData.length > 0) {
      return;
    }

    this.contextConfig = newContext;
    if (event && typeof event.linked === 'boolean') {
      this.isLinkedToGlobal = event.linked;
    }
    this.fetchData();
  }

  onRefresh(): void {
    // In live/realtime mode, bypass periodic background pull refreshes
    if (this.contextConfig.refreshOption === 'live') {
      return;
    }
    this.fetchData();
  }

  getDashboardChild(): DashboardChildComponent | null {
    return this.dashboardChild;
  }

  getDpKey(dp: any): string {
    return `${dp.fragment}__${dp.series}`;
  }

  getDeviceColor(index: number): string {
    const dev = this.config.devices?.[index];
    if (dev && dev.color) {
      return dev.color;
    }
    return this.deviceColors[index % this.deviceColors.length];
  }

  async fetchData() {
    // Diagnostic trace logging to track exact triggers of HTTP measurement list queries
    console.warn('[RadarChart] fetchData triggered! ContextConfig:', JSON.stringify(this.contextConfig));
    console.trace('[RadarChart] Trace back to fetchData caller');

    if (!this.config?.devices || this.config.devices.length === 0 || !this.config?.datapoints || this.config.datapoints.length === 0) {
      this.deviceData = [];
      this.clearRealtimeSubscriptions();
      return;
    }

    this.isLoading = true;

    const dateFrom = this.contextConfig.dateTimeContext?.dateFrom;
    const dateTo = this.contextConfig.dateTimeContext?.dateTo;

    try {
      const promises = this.config.devices.map(async (dev: any) => {
        try {
          const filterParams: any = {
            source: dev.id,
            pageSize: 100,
            revert: true
          };

          if (dateFrom && dateTo) {
            filterParams.dateFrom = dateFrom;
            filterParams.dateTo = dateTo;
            filterParams.pageSize = 1000;
          }

          const { data } = await this.measurementService.list(filterParams);
          const measurements = data || [];

          const values: { [key: string]: number | null } = {};

          this.config.datapoints.forEach((dp: any) => {
            const key = this.getDpKey(dp);
            let value: number | null = null;

            if (this.config.valueMode === 'average' && dateFrom && dateTo) {
              let sum = 0;
              let count = 0;
              measurements.forEach((m: any) => {
                const val = m[dp.fragment]?.[dp.series]?.value;
                if (val !== undefined && val !== null) {
                  sum += Number(val);
                  count++;
                }
              });
              value = count > 0 ? sum / count : null;
            } else {
              const latestMeas = measurements.find(
                (m: any) => m[dp.fragment]?.[dp.series]?.value !== undefined && m[dp.fragment]?.[dp.series]?.value !== null
              );
              if (latestMeas) {
                value = Number(latestMeas[dp.fragment][dp.series].value);
              }
            }

            values[key] = value;
          });

          return {
            id: dev.id,
            name: dev.name,
            values
          };
        } catch (err) {
          console.error(`Failed to fetch telemetry for device ${dev.id}`, err);
          const values: { [key: string]: number | null } = {};
          this.config.datapoints.forEach((dp: any) => {
            values[this.getDpKey(dp)] = null;
          });
          return {
            id: dev.id,
            name: dev.name,
            values
          };
        }
      });

      this.deviceData = await Promise.all(promises);
      this.setupRealtime();
      this.changeRef.detectChanges();
    } catch (err) {
      console.error('Failed to load device telemetry:', err);
    } finally {
      this.isLoading = false;
      this.changeRef.detectChanges();
    }
  }

  private clearRealtimeSubscriptions() {
    this.realtimeSubscriptions.forEach(sub => sub.unsubscribe());
    this.realtimeSubscriptions = [];
    this.subscribedDeviceIds = [];
  }

  private setupRealtime() {
    if (!this.config?.devices || this.config.devices.length === 0 || !this.config?.datapoints || this.config.datapoints.length === 0) {
      this.clearRealtimeSubscriptions();
      return;
    }

    // Check if the list of target devices has changed to avoid redundant unsubscribe/re-subscribe loops
    const targetIds = this.config.devices.map((d: any) => d.id).sort();
    const currentIds = [...this.subscribedDeviceIds].sort();

    if (JSON.stringify(targetIds) === JSON.stringify(currentIds) && this.realtimeSubscriptions.length > 0) {
      return;
    }

    this.clearRealtimeSubscriptions();

    this.config.devices.forEach((dev: any) => {
      const sub = this.measurementRealtime.onCreate$(dev.id).subscribe((msg: any) => {
        console.warn(`[RadarChart] Realtime measurement received for device ${dev.id}:`, JSON.stringify(msg));
        
        // Resolve the actual measurement payload from any nested notification wrappers (e.g. msg.data.data)
        let measurement = msg;
        if (msg && msg.data) {
          if (msg.data.data) {
            measurement = msg.data.data;
          } else {
            measurement = msg.data;
          }
        }
        if (!measurement) return;

        let updated = false;
        this.config.datapoints.forEach((dp: any) => {
          const key = this.getDpKey(dp);
          const val = measurement[dp.fragment]?.[dp.series]?.value;
          if (val !== undefined && val !== null) {
            const devData = this.deviceData.find(d => d.id === dev.id);
            if (devData) {
              devData.values[key] = Number(val);
              updated = true;
            }
          }
        });

        if (updated) {
          // Re-assign array to trigger Angular's view update and CSS transition animations
          this.deviceData = [...this.deviceData];
          this.changeRef.detectChanges();
        }
      });

      this.realtimeSubscriptions.push(sub);
      this.subscribedDeviceIds.push(dev.id);
    });
  }

  // --- SVG Layout Calculations ---

  private getAngle(index: number): number {
    const numAxes = this.config?.datapoints?.length || 3;
    return -Math.PI / 2 + (2 * Math.PI * index) / numAxes;
  }

  getAxisEnd(index: number, multiplier = 1.0): { x: number; y: number } {
    const angle = this.getAngle(index);
    const distance = this.r * multiplier;
    return {
      x: this.cx + distance * Math.cos(angle),
      y: this.cy + distance * Math.sin(angle)
    };
  }

  getGridPoints(level: number): string {
    const numAxes = this.config?.datapoints?.length || 3;
    const points: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const angle = this.getAngle(i);
      const x = this.cx + this.r * level * Math.cos(angle);
      const y = this.cy + this.r * level * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }

  getTextAnchor(index: number): string {
    const angle = this.getAngle(index);
    const cosVal = Math.cos(angle);
    if (cosVal > 0.1) return 'start';
    if (cosVal < -0.1) return 'end';
    return 'middle';
  }

  // --- Data Normalization ---

  private getMinMax(dpIdx: number): { min: number; max: number } {
    const dp = this.config.datapoints[dpIdx];
    const key = this.getDpKey(dp);

    // Prefer configured min/max
    let min = dp.min !== undefined && dp.min !== null && !isNaN(Number(dp.min)) ? Number(dp.min) : null;
    let max = dp.max !== undefined && dp.max !== null && !isNaN(Number(dp.max)) ? Number(dp.max) : null;

    if (min === null || max === null) {
      // Find dynamically from active device values
      let dMin = Infinity;
      let dMax = -Infinity;
      this.deviceData.forEach(dev => {
        const val = dev.values[key];
        if (val !== null && !isNaN(val)) {
          if (val < dMin) dMin = val;
          if (val > dMax) dMax = val;
        }
      });

      if (dMin === Infinity || dMax === -Infinity) {
        dMin = 0;
        dMax = 100;
      } else if (dMin === dMax) {
        dMin = dMin - 10;
        dMax = dMax + 10;
      }

      if (min === null) min = dMin;
      if (max === null) max = dMax;
    }

    // Guard against identical boundaries
    if (min === max) {
      max = min + 1;
    }

    return { min, max };
  }

  private getNormalizedCoordinates(dev: DeviceTelemetry, dpIdx: number): { x: number; y: number; val: number | null; isMissing: boolean } {
    const dp = this.config.datapoints[dpIdx];
    const key = this.getDpKey(dp);
    const rawVal = dev.values[key];

    const angle = this.getAngle(dpIdx);

    if (rawVal === null || isNaN(rawVal)) {
      // For missing values, place them on the axis at 30% distance (inner grid area)
      const dist = this.r * 0.3;
      return {
        x: this.cx + dist * Math.cos(angle),
        y: this.cy + dist * Math.sin(angle),
        val: null,
        isMissing: true
      };
    }

    const { min, max } = this.getMinMax(dpIdx);
    const pct = Math.max(0, Math.min(1, (rawVal - min) / (max - min)));
    const dist = this.r * pct;

    return {
      x: this.cx + dist * Math.cos(angle),
      y: this.cy + dist * Math.sin(angle),
      val: rawVal,
      isMissing: false
    };
  }

  getDevicePolygonPoints(dev: DeviceTelemetry, devIdx: number): string {
    const numAxes = this.config.datapoints.length;
    const points: string[] = [];
    for (let i = 0; i < numAxes; i++) {
      const coords = this.getNormalizedCoordinates(dev, i);
      // For polygon background, we close the shape using the coordinates (even if missing, it draws to the inner N/A zone)
      points.push(`${coords.x},${coords.y}`);
    }
    return points.join(' ');
  }

  getDevicePoints(dev: DeviceTelemetry, devIdx: number): NormalizedPoint[] {
    const numAxes = this.config.datapoints.length;
    const points: NormalizedPoint[] = [];
    for (let i = 0; i < numAxes; i++) {
      points.push(this.getNormalizedCoordinates(dev, i));
    }
    return points;
  }

  getDeviceSegments(dev: DeviceTelemetry, devIdx: number): Array<{ x1: number; y1: number; x2: number; y2: number; isDashed: boolean }> {
    const numAxes = this.config.datapoints.length;
    const segments: Array<{ x1: number; y1: number; x2: number; y2: number; isDashed: boolean }> = [];

    for (let i = 0; i < numAxes; i++) {
      const current = this.getNormalizedCoordinates(dev, i);
      const next = this.getNormalizedCoordinates(dev, (i + 1) % numAxes);

      segments.push({
        x1: current.x,
        y1: current.y,
        x2: next.x,
        y2: next.y,
        isDashed: current.isMissing || next.isMissing
      });
    }

    return segments;
  }
}
