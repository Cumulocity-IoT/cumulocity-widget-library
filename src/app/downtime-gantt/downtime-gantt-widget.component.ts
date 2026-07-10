/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, ViewChild, ElementRef, ChangeDetectorRef, DoCheck } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MeasurementService, EventService } from '@c8y/client';
import { DashboardChildComponent, WidgetTimeContextDateRangeService, MeasurementRealtimeService, EventRealtimeService } from '@c8y/ngx-components';
import { AlarmSeverityToIconPipe, AlarmSeverityToLabelPipe } from '@c8y/ngx-components/alarms';
import { ChartAlarmsService, ChartEventsService, ChartHelpersService } from '@c8y/ngx-components/echart';
import {
  DisplayMode,
  GlobalContextState,
  GLOBAL_CONTEXT_DISPLAY_MODE,
  PRESET_NAME
} from '@c8y/ngx-components/global-context';
import { Subscription } from 'rxjs';
import * as echarts from 'echarts';

interface StateBlock {
  state: any;
  label: string;
  color: string;
  isDowntime: boolean;
  start: number;
  end: number;
  duration: number;
  formattedDuration: string;
  startDateStr: string;
  endDateStr: string;
}

interface DataPoint {
  time: number;
  value: any;
}

@Component({
  selector: 'lib-downtime-gantt-widget',
  standalone: false,
  providers: [
    DatePipe,
    AlarmSeverityToIconPipe,
    AlarmSeverityToLabelPipe,
    WidgetTimeContextDateRangeService,
    ChartAlarmsService,
    ChartEventsService,
    ChartHelpersService,
    MeasurementRealtimeService,
    EventRealtimeService
  ],
  template: `
    <div class="gantt-widget-container" [class.no-data]="!hasData">
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

      <!-- Local Time Context Controls for Config Mode -->
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

      <div class="gantt-content">
        @if (isLoading) {
          <div class="state-container text-center p-24">
            <span class="spinner"></span>
            <p class="m-t-8 text-muted text-small">Fetching state data...</p>
          </div>
        } @else if (!getTargetDeviceId()) {
          <div class="state-container text-center p-24">
            <i c8yIcon="hdd-o" class="text-muted text-large m-b-8"></i>
            <p class="text-muted">No target device selected. Please configure the widget or place it in a device dashboard.</p>
          </div>
        } @else if (!config?.stateMappings || config.stateMappings.length === 0) {
          <div class="state-container text-center p-24">
            <i c8yIcon="gears" class="text-muted text-large m-b-8"></i>
            <p class="text-muted">Please configure state mappings in the widget settings.</p>
          </div>
        } @else {
          <!-- Stats Summary Bar (Availability, Downtime, Uptime) -->
          @if (config?.showStats !== false) {
            <div class="stats-grid">
              <!-- Current Status -->
              <div class="stat-card current-status-card">
                <div class="stat-header">Machine Status</div>
                <div style="display: flex; flex-direction: row; align-items: center; gap: 10px; margin-top: 4px;">
                  <span class="status-indicator" [style.background-color]="currentStatusColor" [style.box-shadow]="'0 0 12px ' + currentStatusColor"></span>
                  <span class="status-label">{{ currentStatusLabel }}</span>
                </div>
              </div>

              <!-- Availability -->
              <div class="stat-card">
                <div class="stat-header">Availability</div>
                <div class="stat-body">
                  <span class="stat-value">{{ availability | number:'1.1-1' }}%</span>
                  <div class="availability-bar-container">
                    <div class="availability-bar" [style.width.%]="availability" [style.background-color]="availability > 90 ? '#2ecc71' : availability > 70 ? '#f39c12' : '#e74c3c'"></div>
                  </div>
                </div>
              </div>

              <!-- Downtime -->
              <div class="stat-card">
                <div class="stat-header">Total Downtime</div>
                <div class="stat-body">
                  <span class="stat-value text-danger">{{ formattedDowntime }}</span>
                </div>
              </div>

              <!-- Uptime -->
              <div class="stat-card">
                <div class="stat-header">Total Active Uptime</div>
                <div class="stat-body">
                  <span class="stat-value text-success">{{ formattedUptime }}</span>
                </div>
              </div>
            </div>
          }

          <!-- Gantt Chart -->
          <div class="chart-section m-t-16" style="position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="chart-title" style="margin: 0;">Timeline & Transitions</div>
              @if (contextConfig.refreshOption === 'live') {
                <button 
                  type="button" 
                  class="btn btn-default btn-xs"
                  (click)="goToLive()"
                  style="display: flex; align-items: center; gap: 4px; border-radius: 4px; font-weight: 500;"
                  title="Scroll timeline to current live time"
                >
                  <span class="status-indicator" style="width: 8px; height: 8px; margin: 0; background-color: #e74c3c; animation: pulse 1.5s infinite;"></span>
                  Go to Live
                </button>
              }
            </div>
            <div #chartContainer class="chart-container"></div>
            <p class="help-block text-muted text-center text-xsmall" style="margin-top: 4px;">
              <i c8yIcon="info-circle"></i> Use mouse wheel to zoom, drag to pan the timeline.
            </p>
          </div>

          <!-- Downtime Log Table -->
          @if (config?.showLogs) {
            <div class="log-section m-t-24">
              <div class="log-header">Downtime Logs</div>
              @if (downtimeBlocks.length === 0) {
                <div class="no-downtime-state">
                  <i c8yIcon="check-circle" class="text-success text-large m-b-8"></i>
                  <p class="text-success font-medium">No downtime events recorded in this period.</p>
                  <small class="text-muted">Machine is operating at 100% availability.</small>
                </div>
              } @else {
                <div class="table-responsive">
                  <table class="table table-striped table-hover c8y-table">
                    <thead>
                      <tr>
                        <th>State</th>
                        <th>Started At</th>
                        <th>Ended At</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (block of downtimeBlocks; track block.start) {
                        <tr>
                          <td>
                            <span class="state-badge" [style.background-color]="block.color"></span>
                            <strong>{{ block.label }}</strong>
                          </td>
                          <td>{{ block.startDateStr }}</td>
                          <td>{{ block.endDateStr }}</td>
                          <td class="font-medium text-danger">{{ block.formattedDuration }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .gantt-widget-container {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      background: #ffffff;
      color: #1e293b;
      box-sizing: border-box;
      position: relative;
    }
    .gantt-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px;
      overflow-y: auto;
    }
    .state-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    .spinner {
      display: inline-block;
      width: 28px;
      height: 28px;
      border: 3px solid rgba(0,0,0,0.08);
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776bf);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      transition: all 0.2s ease;
    }
    .stat-card:hover {
      border-color: #cbd5e1;
      transform: translateY(-1px);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .stat-header {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .stat-body {
      display: flex;
      flex-direction: column;
    }
    .stat-value {
      font-size: 20px;
      font-weight: 800;
      line-height: 1.2;
    }
    .stat-subtext {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }
    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
      position: relative;
      animation: pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.15); opacity: 0.8; }
    }
    .status-label {
      font-size: 16px;
      font-weight: 700;
    }
    .availability-bar-container {
      width: 100%;
      height: 4px;
      background: #e2e8f0;
      border-radius: 2px;
      margin-top: 6px;
      overflow: hidden;
    }
    .availability-bar {
      height: 100%;
      border-radius: 2px;
      transition: width 0.5s ease-out;
    }
    .chart-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    .chart-title {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 12px;
    }
    .chart-container {
      width: 100%;
      height: 140px;
      min-height: 120px;
    }
    .log-section {
      display: flex;
      flex-direction: column;
    }
    .log-header {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .no-downtime-state {
      background: #f0fdf4;
      border: 1px dashed #bbf7d0;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
    }
    .state-badge {
      width: 10px;
      height: 10px;
      border-radius: 30%;
      display: inline-block;
      margin-right: 8px;
      vertical-align: middle;
    }
    .table-responsive {
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .table {
      margin-bottom: 0;
    }
    .table th {
      background: #f8fafc;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
    }
  `]
})
export class DowntimeGanttWidgetComponent implements OnInit, OnChanges, OnDestroy, DoCheck {
  @Input() config: any;

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  private measurementService = inject(MeasurementService);
  private eventService = inject(EventService);
  private measurementRealtime = inject(MeasurementRealtimeService);
  private eventRealtime = inject(EventRealtimeService);
  private dashboardChild = inject(DashboardChildComponent, { optional: true });
  private changeRef = inject(ChangeDetectorRef);
  private datePipe = inject(DatePipe);

  displayMode: DisplayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
  readonly GLOBAL_CONTEXT_DISPLAY_MODE = GLOBAL_CONTEXT_DISPLAY_MODE;
  readonly PRESET_NAME = PRESET_NAME;

  contextConfig: GlobalContextState = {};
  isLoading = false;
  hasData = false;
  isLinkedToGlobal = true;

  // Render variables
  currentStatusLabel = 'Unknown';
  currentStatusColor = '#94a3b8';
  availability = 100;
  formattedDowntime = '0s';
  formattedUptime = '0s';
  downtimeBlocksCount = 0;

  // Internal data arrays
  downtimeBlocks: StateBlock[] = [];
  allBlocks: StateBlock[] = [];
  
  private historicalDataPoints: DataPoint[] = [];
  private realtimeDataPoints: DataPoint[] = [];
  private initialPoint: DataPoint | null = null;

  private myChart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private realtimeSubscriptions: Subscription[] = [];
  private liveTimer: any = null;
  private shouldResetZoom = false;
  private cachedDateFrom = 0;
  private cachedDateTo = 0;
  private cachedRefreshOption = '';

  ngOnInit() {
    this.initContext();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && changes['config'].currentValue) {
      const prev = changes['config'].previousValue;
      const curr = changes['config'].currentValue;

      const hasDeviceChanges = prev?.device?.id !== curr?.device?.id;
      const hasInputChanges = prev?.inputType !== curr?.inputType ||
                              JSON.stringify(prev?.datapoints) !== JSON.stringify(curr?.datapoints) ||
                              prev?.eventType !== curr?.eventType ||
                              prev?.eventStateProperty !== curr?.eventStateProperty;
      const hasMappingChanges = JSON.stringify(prev?.stateMappings) !== JSON.stringify(curr?.stateMappings);
      const hasTimeChanges = JSON.stringify(prev?.dateTimeContext) !== JSON.stringify(curr?.dateTimeContext) ||
                             prev?.refreshOption !== curr?.refreshOption;

      if (hasDeviceChanges || hasInputChanges || hasMappingChanges || hasTimeChanges || !prev) {
        this.initContext(curr);
        this.fetchData();
      }
    }
  }

  ngDoCheck() {
    if (this.myChart && this.chartContainer) {
      // Periodic check to resize charts properly
      this.myChart.resize();
    }
  }

  ngOnDestroy() {
    this.clearLiveTimer();
    this.destroyChart();
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

    this.cachedDateFrom = this.getTimestamp(dateTimeContext?.dateFrom);
    this.cachedDateTo = this.getTimestamp(dateTimeContext?.dateTo);
    this.cachedRefreshOption = refreshOption || '';
  }

  onContextChange(event: any): void {
    const newContext = event?.context || event || {};
    let hasChanged = false;

    const fromB = this.getTimestamp(newContext.dateTimeContext?.dateFrom);
    const toB = this.getTimestamp(newContext.dateTimeContext?.dateTo);
    const refreshOptionB = newContext.refreshOption;

    const oldDuration = this.cachedDateTo - this.cachedDateFrom;
    const newDuration = toB - fromB;

    if (refreshOptionB === 'live') {
      hasChanged = 
        this.cachedRefreshOption !== 'live' ||
        oldDuration !== newDuration ||
        (event && typeof event.linked === 'boolean' && event.linked !== this.isLinkedToGlobal);
    } else {
      hasChanged = 
        this.cachedDateFrom !== fromB ||
        this.cachedDateTo !== toB ||
        this.cachedRefreshOption !== refreshOptionB ||
        (event && typeof event.linked === 'boolean' && event.linked !== this.isLinkedToGlobal);
    }

    if (!hasChanged && this.historicalDataPoints.length > 0) {
      return;
    }

    this.cachedDateFrom = fromB;
    this.cachedDateTo = toB;
    this.cachedRefreshOption = refreshOptionB;
    
    this.contextConfig = { ...newContext };
    if (event && typeof event.linked === 'boolean') {
      this.isLinkedToGlobal = event.linked;
    }
    this.shouldResetZoom = true;
    this.fetchData();
  }

  private getTimestamp(val: any): number {
    if (!val) return 0;
    if (val instanceof Date) return val.getTime();
    
    const str = val.toString().trim().toLowerCase();
    if (str.startsWith('now')) {
      const now = Date.now();
      if (str === 'now') return now;
      
      const match = str.match(/^now\s*-\s*(\d+)\s*([smhd])$/);
      if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2];
        let ms = 0;
        if (unit === 's') ms = amount * 1000;
        else if (unit === 'm') ms = amount * 60 * 1000;
        else if (unit === 'h') ms = amount * 60 * 60 * 1000;
        else if (unit === 'd') ms = amount * 24 * 60 * 60 * 1000;
        return now - ms;
      }
    }
    
    const time = new Date(val).getTime();
    return isNaN(time) ? 0 : time;
  }

  onRefresh(): void {
    if (this.contextConfig.refreshOption === 'live') {
      return;
    }
    this.fetchData();
  }

  getDashboardChild(): DashboardChildComponent | null {
    return this.dashboardChild;
  }

  getTargetDeviceId(): string | null {
    if (this.config?.device?.id) {
      return this.config.device.id;
    }
    if (this.dashboardChild && this.dashboardChild.data && this.dashboardChild.data.id) {
      return this.dashboardChild.data.id;
    }
    return null;
  }

  getDashboardChildDeviceId(): string | null {
    return this.dashboardChild?.data?.id || null;
  }

  async fetchData() {
    const deviceId = this.getTargetDeviceId();
    if (!deviceId) return;

    if (this.config.inputType === 'measurement' && (!this.config.datapoints || this.config.datapoints.length === 0)) {
      this.hasData = false;
      this.changeRef.detectChanges();
      return;
    }

    this.isLoading = true;
    this.hasData = false;
    this.destroyChart();
    this.clearRealtimeSubscriptions();
    this.clearLiveTimer();
    this.changeRef.detectChanges();

    // Reset data structures
    this.historicalDataPoints = [];
    this.realtimeDataPoints = [];
    this.initialPoint = null;
    this.shouldResetZoom = true;

    try {
      const fromMs = this.getTimestamp(this.contextConfig.dateTimeContext?.dateFrom) || (Date.now() - 24 * 60 * 60 * 1000);
      const toMs = this.getTimestamp(this.contextConfig.dateTimeContext?.dateTo) || Date.now();

      const dateFrom = new Date(fromMs).toISOString();
      const dateTo = new Date(toMs).toISOString();

      // 1. Fetch initial state (last point before dateFrom)
      await this.fetchInitialState(deviceId, dateFrom);

      // 2. Fetch primary range data points
      if (this.config.inputType === 'event') {
        await this.fetchEventData(deviceId, dateFrom, dateTo);
      } else {
        await this.fetchMeasurementData(deviceId, dateFrom, dateTo);
      }

      this.hasData = true;
      
      // 3. Process and render
      this.processStatesAndRender();

      // 4. Setup realtime subscriptions if live
      if (this.contextConfig.refreshOption === 'live') {
        this.setupRealtime(deviceId);
        this.startLiveTimer();
      } else {
        this.clearLiveTimer();
      }

    } catch (err) {
      console.error('Failed to load downtime Gantt data:', err);
    } finally {
      this.isLoading = false;
      this.changeRef.detectChanges();
    }
  }

  private async fetchInitialState(deviceId: string, dateFrom: string) {
    try {
      if (this.config.inputType === 'event') {
        const { data: events } = await this.eventService.list({
          source: deviceId,
          type: this.config.eventType,
          dateTo: dateFrom,
          pageSize: 1,
          revert: true
        });
        if (events && events.length > 0) {
          const val = this.resolvePath(events[0], this.config.eventStateProperty);
          if (val !== undefined && val !== null) {
            this.initialPoint = {
              time: new Date(dateFrom).getTime(), // Bound to start of period
              value: val
            };
          }
        }
      } else {
        const dp = this.config.datapoints?.[0];
        if (!dp) return;
        const { data: measurements } = await this.measurementService.list({
          source: deviceId,
          valueFragmentType: dp.fragment,
          valueFragmentSeries: dp.series,
          dateTo: dateFrom,
          pageSize: 1,
          revert: true
        });
        if (measurements && measurements.length > 0) {
          const val = measurements[0][dp.fragment]?.[dp.series]?.value;
          if (val !== undefined && val !== null) {
            this.initialPoint = {
              time: new Date(dateFrom).getTime(),
              value: val
            };
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch initial state before range:', err);
    }
  }

  private async fetchMeasurementData(deviceId: string, dateFrom: string, dateTo: string) {
    const dp = this.config.datapoints?.[0];
    if (!dp) return;
    const { data: measurements } = await this.measurementService.list({
      source: deviceId,
      valueFragmentType: dp.fragment,
      valueFragmentSeries: dp.series,
      dateFrom,
      dateTo,
      pageSize: 2000
    });

    this.historicalDataPoints = measurements
      .map((m: any) => ({
        time: new Date(m.time).getTime(),
        value: m[dp.fragment]?.[dp.series]?.value
      }))
      .filter((dpPoint: any) => dpPoint.value !== undefined && dpPoint.value !== null)
      .sort((a, b) => a.time - b.time);
  }

  private async fetchEventData(deviceId: string, dateFrom: string, dateTo: string) {
    const { data: events } = await this.eventService.list({
      source: deviceId,
      type: this.config.eventType,
      dateFrom,
      dateTo,
      pageSize: 2000
    });

    this.historicalDataPoints = events
      .map((e: any) => ({
        time: new Date(e.time || e.creationTime).getTime(),
        value: this.resolvePath(e, this.config.eventStateProperty)
      }))
      .filter((dp: any) => dp.value !== undefined && dp.value !== null)
      .sort((a, b) => a.time - b.time);
  }

  private setupRealtime(deviceId: string) {
    this.clearRealtimeSubscriptions();

    if (this.config.inputType === 'measurement') {
      const dp = this.config.datapoints?.[0];
      if (!dp) return;
      const sub = this.measurementRealtime.onCreate$(deviceId).subscribe((msg: any) => {
        const measurement = msg?.data?.data || msg?.data || msg;
        if (measurement && measurement[dp.fragment]?.[dp.series]) {
          const rawVal = measurement[dp.fragment][dp.series].value;
          this.handleRealtimePoint({
            time: new Date(measurement.time).getTime(),
            value: rawVal
          });
        }
      });
      this.realtimeSubscriptions.push(sub);
    } else {
      const sub = this.eventRealtime.onCreate$(deviceId).subscribe((msg: any) => {
        const event = msg?.data?.data || msg?.data || msg;
        if (event && event.type === this.config.eventType) {
          const rawVal = this.resolvePath(event, this.config.eventStateProperty);
          if (rawVal !== undefined && rawVal !== null) {
            this.handleRealtimePoint({
              time: new Date(event.time || event.creationTime).getTime(),
              value: rawVal
            });
          }
        }
      });
      this.realtimeSubscriptions.push(sub);
    }
  }

  private handleRealtimePoint(dp: DataPoint) {
    // Avoid double adding same point
    if (this.realtimeDataPoints.some(p => p.time === dp.time)) return;

    this.realtimeDataPoints.push(dp);
    this.realtimeDataPoints.sort((a, b) => a.time - b.time);
    
    this.processStatesAndRender();
  }

  private clearRealtimeSubscriptions() {
    this.realtimeSubscriptions.forEach(sub => sub.unsubscribe());
    this.realtimeSubscriptions = [];
  }

  private processStatesAndRender() {
    const dateFrom = new Date(this.contextConfig.dateTimeContext?.dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000)).getTime();
    const dateTo = new Date(this.contextConfig.dateTimeContext?.dateTo || new Date()).getTime();
    const now = Date.now();

    const isLive = this.contextConfig.refreshOption === 'live';
    let chartMin = dateFrom;
    let chartMax = dateTo;

    if (isLive) {
      const duration = Math.max(1000, dateTo - dateFrom);
      chartMin = now - duration;
      chartMax = now;
    }

    // Merge initial point, historical, and real-time points
    let points: DataPoint[] = [];
    if (this.initialPoint) {
      points.push(this.initialPoint);
    }
    points = [...points, ...this.historicalDataPoints, ...this.realtimeDataPoints];

    // Filter points to keep only those before chartMax
    points = points
      .filter(p => p.time <= chartMax)
      .sort((a, b) => a.time - b.time);

    // Separate into points before chartMin and during the visible range
    const pointsBefore = points.filter(p => p.time < chartMin);
    const pointsDuring = points.filter(p => p.time >= chartMin && p.time <= chartMax);

    let startState = 'unknown';
    if (pointsBefore.length > 0) {
      startState = pointsBefore[pointsBefore.length - 1].value;
    }

    const computedBlocks: StateBlock[] = [];
    let currentStart = chartMin;

    if (pointsDuring.length === 0) {
      const duration = chartMax - chartMin;
      if (duration > 0) {
        computedBlocks.push(this.createBlock(startState, chartMin, chartMax));
      }
    } else {
      const firstPoint = pointsDuring[0];
      if (firstPoint.time > chartMin) {
        computedBlocks.push(this.createBlock(startState, chartMin, firstPoint.time));
        currentStart = firstPoint.time;
      }

      for (let i = 0; i < pointsDuring.length; i++) {
        const pt = pointsDuring[i];
        const nextTime = (i + 1 < pointsDuring.length) ? pointsDuring[i + 1].time : chartMax;
        const blockDuration = nextTime - pt.time;

        if (blockDuration > 0) {
          computedBlocks.push(this.createBlock(pt.value, pt.time, nextTime));
        }
        currentStart = nextTime;
      }

      if (currentStart < chartMax) {
        const lastVal = pointsDuring[pointsDuring.length - 1].value;
        computedBlocks.push(this.createBlock(lastVal, currentStart, chartMax));
      }
    }

    this.allBlocks = computedBlocks;
    this.downtimeBlocks = computedBlocks.filter(b => b.isDowntime);
    this.downtimeBlocksCount = this.downtimeBlocks.length;

    // Calculate status dot and labels for header based on the latest overall data point (live or historical)
    let currentStatusVal = 'unknown';
    const allAvailablePoints = [...this.historicalDataPoints, ...this.realtimeDataPoints];
    if (allAvailablePoints.length > 0) {
      currentStatusVal = allAvailablePoints[allAvailablePoints.length - 1].value;
    } else if (this.initialPoint) {
      currentStatusVal = this.initialPoint.value;
    }

    if (currentStatusVal === 'unknown') {
      this.currentStatusLabel = 'Unknown';
      this.currentStatusColor = '#94a3b8';
    } else if (this.config.stateMappings) {
      const match = this.config.stateMappings.find(
        (m: any) => m.value.toString().trim().toLowerCase() === currentStatusVal.toString().trim().toLowerCase()
      );
      if (match) {
        this.currentStatusLabel = match.label;
        this.currentStatusColor = match.color;
      } else {
        this.currentStatusLabel = `Value: ${currentStatusVal}`;
        this.currentStatusColor = '#94a3b8';
      }
    } else {
      this.currentStatusLabel = `Value: ${currentStatusVal}`;
      this.currentStatusColor = '#94a3b8';
    }

    // Calculate Availability and Durations
    let totalDowntimeMs = 0;
    let totalUptimeMs = 0;

    computedBlocks.forEach(b => {
      if (b.state !== 'unknown') {
        if (b.isDowntime) {
          totalDowntimeMs += b.duration;
        } else {
          totalUptimeMs += b.duration;
        }
      }
    });

    const activeTotal = totalUptimeMs + totalDowntimeMs;
    this.availability = activeTotal > 0 ? (totalUptimeMs / activeTotal) * 100 : 100;

    this.formattedDowntime = this.formatDuration(totalDowntimeMs);
    this.formattedUptime = this.formatDuration(totalUptimeMs);

    // Force refresh Angular UI
    this.changeRef.detectChanges();

    // Trigger Chart Init (wait briefly for DOM layout render)
    setTimeout(() => {
      this.initChart(chartMin, chartMax);
    }, 50);
  }

  private createBlock(val: any, start: number, end: number): StateBlock {
    const duration = end - start;
    let label = `Value: ${val}`;
    let color = '#94a3b8'; // default slate grey
    let isDowntime = false;

    if (val === 'unknown') {
      label = 'Unknown / No Signal';
      color = '#e2e8f0'; // very light grey
    } else if (this.config.stateMappings) {
      // Exact matching check (supporting type coercion since values can be saved as strings/numbers)
      const match = this.config.stateMappings.find(
        (m: any) => m.value.toString().trim().toLowerCase() === val.toString().trim().toLowerCase()
      );
      if (match) {
        label = match.label;
        color = match.color;
        isDowntime = match.isDowntime;
      }
    }

    return {
      state: val,
      label,
      color,
      isDowntime,
      start,
      end,
      duration,
      formattedDuration: this.formatDuration(duration),
      startDateStr: this.datePipe.transform(start, 'yyyy-MM-dd HH:mm:ss') || '',
      endDateStr: this.datePipe.transform(end, 'yyyy-MM-dd HH:mm:ss') || ''
    };
  }

  private startLiveTimer() {
    this.clearLiveTimer();
    this.liveTimer = setInterval(() => {
      this.processStatesAndRender();
    }, 1000);
  }

  private clearLiveTimer() {
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  private initChart(dateFrom: number, dateTo: number) {
    if (!this.chartContainer) return;

    if (!this.myChart) {
      this.myChart = echarts.init(this.chartContainer.nativeElement);
      this.resizeObserver = new ResizeObserver(() => {
        this.myChart?.resize();
      });
      this.resizeObserver.observe(this.chartContainer.nativeElement);
    }

    // Group blocks by label/state to form series. 
    // This allows ECharts to automatically render legends.
    const uniqueStates = new Set<string>();
    this.allBlocks.forEach(b => uniqueStates.add(b.label));

    // We mapping categories on the Y-axis
    // For single device target, we only have 1 category
    const categories = ['Machine State'];

    const seriesList: any[] = [];

    // Make ECharts Series for each unique State so they automatically show up on the legend!
    uniqueStates.forEach(stateLabel => {
      const stateBlocks = this.allBlocks.filter(b => b.label === stateLabel);
      const stateColor = stateBlocks[0]?.color || '#94a3b8';

      const data = stateBlocks.map(b => {
        return {
          name: b.label,
          value: [
            0, // Y category index
            b.start, // X start time
            b.end, // X end time
            b.duration,
            b.formattedDuration
          ],
          itemStyle: {
            color: stateColor
          }
        };
      });

      seriesList.push({
        name: stateLabel,
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const categoryIndex = api.value(0);
          const start = api.coord([api.value(1), categoryIndex]);
          const end = api.coord([api.value(2), categoryIndex]);
          const height = 40;

          const rectShape = echarts.graphic.clipRectByRect({
            x: start[0],
            y: start[1] - height / 2,
            width: Math.max(end[0] - start[0], 2), // At least 2px width
            height: height
          }, {
            x: params.coordSys.x,
            y: params.coordSys.y,
            width: params.coordSys.width,
            height: params.coordSys.height
          });

          return rectShape && {
            type: 'rect',
            transition: ['shape'],
            shape: rectShape,
            style: api.style()
          };
        },
        itemStyle: {
          color: stateColor
        },
        encode: {
          x: [1, 2],
          y: 0
        },
        data: data
      });
    });

    const option = {
      tooltip: {
        formatter: (params: any) => {
          const blockName = params.marker + ' <b>' + params.name + '</b>';
          const durStr = params.value[4];
          const startStr = this.datePipe.transform(params.value[1], 'HH:mm:ss');
          const endStr = this.datePipe.transform(params.value[2], 'HH:mm:ss');
          return `${blockName}<br/>Duration: <b>${durStr}</b><br/>Time: ${startStr} - ${endStr}`;
        }
      },
      legend: {
        data: Array.from(uniqueStates),
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          color: '#475569',
          fontSize: 10,
          fontFamily: 'Outfit, sans-serif'
        }
      },
      grid: {
        top: 20,
        left: 20,
        right: 20,
        bottom: 40,
        containLabel: true
      },
      xAxis: {
        type: 'time',
        min: dateFrom,
        max: dateTo,
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f1f5f9'
          }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          fontFamily: 'Outfit, sans-serif'
        }
      },
      yAxis: {
        type: 'category',
        data: categories,
        splitLine: {
          show: false
        },
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          show: false // we hide it since we have stats headers
        }
      },
      // Enable native zoom/pan interactive handles
      dataZoom: [
        {
          type: 'inside',
          filterMode: 'weakFilter',
          ...(this.shouldResetZoom ? { start: 0, end: 100 } : {})
        }
      ],
      series: seriesList
    };

    const isZoomReset = this.shouldResetZoom;
    this.shouldResetZoom = false; // Reset flag after use
    this.myChart.setOption(option, isZoomReset);
  }

  goToLive() {
    if (!this.myChart) return;
    const option = this.myChart.getOption() as any;
    const dataZoom = option?.dataZoom?.[0];
    if (dataZoom) {
      const start = dataZoom.start ?? 0;
      const end = dataZoom.end ?? 100;
      const range = end - start;
      
      this.myChart.dispatchAction({
        type: 'dataZoom',
        start: Math.max(0, 100 - range),
        end: 100
      });
    }
  }

  private destroyChart() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.myChart) {
      this.myChart.dispose();
      this.myChart = null;
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private resolvePath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }
}
