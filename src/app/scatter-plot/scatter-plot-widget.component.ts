/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnDestroy, OnInit, ViewChild, OnChanges, SimpleChanges, inject, DoCheck, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CoreModule, WidgetTimeContextDateRangeService, MeasurementRealtimeService, DashboardChildComponent } from '@c8y/ngx-components';
import { MeasurementService } from '@c8y/client';
import { Subscription } from 'rxjs';
import * as echarts from 'echarts';

@Component({
  selector: 'lib-scatter-plot-widget',
  standalone: false,
  host: {
    style: 'display: block; height: 100%; width: 100%;'
  },
  providers: [
    DatePipe,
    WidgetTimeContextDateRangeService,
    MeasurementRealtimeService
  ],
  template: `
    <div class="scatter-widget-container">
      <!-- Header bar with local time controls and actions -->
      <div class="widget-header-bar">
        <div class="widget-meta">
          <span class="device-name-badge">
            <i c8yIcon="hdd-o"></i> {{ getDeviceName() }}
          </span>
        </div>
        <div class="header-actions">
          <!-- Time range dropdown override -->
          <div class="time-override-select">
            <i c8yIcon="clock-o" class="m-r-4"></i>
            <select [(ngModel)]="localTimeWindow" (change)="onTimeWindowChange()" class="form-control input-sm select-override">
              <option value="lastMinute">Last Minute</option>
              <option value="lastHour">Last Hour</option>
              <option value="last2Hours">Last 2 Hours</option>
              <option value="last4Hours">Last 4 Hours</option>
              <option value="last8Hours">Last 8 Hours</option>
              <option value="lastDay">Last Day</option>
            </select>
          </div>
          
          <button 
            type="button" 
            class="btn btn-clean btn-xs" 
            title="Refresh Data"
            (click)="loadData()"
            [disabled]="loading"
          >
            <i c8yIcon="refresh" [ngClass]="{ 'spin': loading }"></i>
          </button>
        </div>
      </div>

      <!-- Main Widget Body -->
      <div class="widget-body">
        <!-- Error & Config Warnings -->
        @if (errorMsg) {
          <div class="center-state warning-state">
            <i c8yIcon="exclamation-circle" class="text-warning text-large m-b-8"></i>
            <p class="font-medium text-center text-muted">{{ errorMsg }}</p>
          </div>
        } @else if (loading && fullDataset.length === 0) {
          <!-- Loading spinner -->
          <div class="center-state">
            <span class="spinner"></span>
            <p class="m-t-8 text-muted text-small font-medium">Aligning measurement feeds...</p>
          </div>
        } @else if (fullDataset.length === 0) {
          <!-- Empty State -->
          <div class="center-state empty-state">
            <i c8yIcon="line-chart" class="text-muted text-large m-b-8"></i>
            <p class="text-muted font-medium text-center">No paired X/Y measurements found in this window.</p>
            <small class="text-muted text-center m-t-4" style="max-width: 250px;">
              Verify that both measurements are being sent with matched timestamps, or enable Aggregation in settings.
            </small>
          </div>
        }

        <!-- ECharts Target Container -->
        <div 
          #chartContainer 
          class="chart-container" 
          [style.display]="(errorMsg || fullDataset.length === 0) ? 'none' : 'block'"
        ></div>
      </div>

      <!-- Replay Controls Dock -->
      @if (fullDataset.length > 0 && !errorMsg) {
        <div class="replay-control-dock" [ngClass]="{ 'active-dock': replayActive }">
          <div class="replay-main-row">
            <!-- Play/Pause -->
            <button 
              type="button" 
              class="btn btn-primary btn-sm btn-replay-action" 
              (click)="toggleReplay()"
              [title]="replayActive ? 'Pause Replay' : 'Start Replay'"
            >
              <i [c8yIcon]="replayActive ? 'pause' : 'play'"></i>
            </button>

            <!-- Scrubber Slider -->
            <div class="scrubber-container">
              <input 
                type="range" 
                min="1" 
                [attr.max]="fullDataset.length" 
                [value]="replayProgress" 
                (input)="onSliderInput($event)"
                class="replay-slider"
              />
              <span class="replay-counter">{{ replayProgress }} / {{ fullDataset.length }} points</span>
            </div>

            <!-- Speed control -->
            <div class="speed-select-wrapper">
              <span class="speed-label">Speed:</span>
              <select [(ngModel)]="replaySpeed" (change)="onSpeedChange()" class="form-control input-sm speed-select">
                <option [value]="0.5">0.5x</option>
                <option [value]="1">1.0x</option>
                <option [value]="2">2.0x</option>
                <option [value]="5">5.0x</option>
                <option [value]="10">10.0x</option>
                <option [value]="20">20.0x</option>
              </select>
            </div>

            <!-- Exit Replay -->
            <button 
              type="button" 
              class="btn btn-danger btn-sm btn-replay-action"
              (click)="exitReplay()"
              [disabled]="!replayActive && replayProgress === fullDataset.length"
              title="Exit Replay and return to Live data"
              style="margin-left: 8px;"
            >
              <i c8yIcon="times"></i>
            </button>
          </div>

          <!-- Chronology Timestamp indicator -->
          <div class="timestamp-hud">
            <i c8yIcon="clock-o" class="m-r-4"></i>
            <span>Current Time: <strong>{{ currentReplayTimeStr }}</strong></span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .scatter-widget-container {
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
    .widget-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      border-radius: 4px 4px 0 0;
    }
    .widget-meta {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .widget-label-badge {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .device-name-badge {
      color: #64748b;
      font-weight: 500;
      font-size: 11px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .time-override-select {
      display: flex;
      align-items: center;
      color: #64748b;
      font-size: 11px;
    }
    .select-override {
      height: 24px;
      padding: 0px 4px;
      font-size: 11px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      color: #334155;
      font-weight: 500;
      cursor: pointer;
    }
    .widget-body {
      flex: 1;
      position: relative;
      min-height: 0;
      width: 100%;
    }
    .chart-container {
      width: 100%;
      height: 100%;
      min-height: 220px;
    }
    .center-state {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 80%;
    }
    .warning-state, .empty-state {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      border: 1px dashed #cbd5e1;
    }
    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 3px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .spin {
      animation: spin 1.2s linear infinite;
    }

    /* Replay HUD Dock Panel */
    .replay-control-dock {
      background: #f8fafc;
      border-top: 1px solid #cbd5e1;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .active-dock {
      background: #eff6ff;
      border-top-color: #bfdbfe;
    }
    .replay-main-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }
    .btn-replay-action {
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
    }
    .scrubber-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .replay-slider {
      flex: 1;
      cursor: pointer;
      height: 4px;
      accent-color: #3b82f6;
    }
    .replay-counter {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
      white-space: nowrap;
      min-width: 75px;
      text-align: right;
    }
    .speed-select-wrapper {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .speed-label {
      font-size: 11px;
      color: #64748b;
      font-weight: 500;
    }
    .speed-select {
      height: 24px;
      font-size: 11px;
      padding: 2px 4px;
      border-radius: 4px;
      cursor: pointer;
      width: 60px;
    }
    .btn-exit-replay {
      font-size: 10px;
      padding: 3px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .timestamp-hud {
      display: flex;
      align-items: center;
      font-size: 10px;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      padding-top: 4px;
      margin-top: 2px;
    }
    .timestamp-hud strong {
      color: #1e293b;
      margin-left: 4px;
    }
  `]
})
export class ScatterPlotWidgetComponent implements OnInit, OnDestroy, OnChanges, DoCheck {
  @Input() config: any;

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  private measurementService = inject(MeasurementService);
  private measurementRealtime = inject(MeasurementRealtimeService);
  private changeRef = inject(ChangeDetectorRef);
  private dashboardChild = inject(DashboardChildComponent, { optional: true });

  // States
  loading = false;
  errorMsg: string | null = null;
  
  // Time ranges
  localTimeWindow = 'lastHour';

  // Raw & Aligned datasets
  fullDataset: any[] = []; // Array of [x, y, timestampMs, datetimeStr]
  
  // Realtime handlers
  private realtimeSubX?: Subscription;
  private realtimeSubY?: Subscription;
  private latestX: { value: number; timeMs: number } | null = null;
  private latestY: { value: number; timeMs: number } | null = null;

  // Replay properties
  replayActive = false;
  replayProgress = 1;
  replaySpeed = 1;
  currentReplayTimeStr = 'N/A';
  private replayIntervalId: any = null;

  // ECharts references
  private myChart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Change detection triggers
  private previousConfigJson = '';

  ngOnInit() {
    this.initConfig();
    this.loadData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && changes['config'].currentValue) {
      this.initConfig();
      this.loadData();
    }
  }

  ngDoCheck() {
    const configJson = JSON.stringify({
      device: this.config?.device?.id,
      datapointX: this.config?.datapointX,
      datapointY: this.config?.datapointY,
      timeWindow: this.config?.timeWindow,
      aggregation: this.config?.aggregation,
      gradientColors: this.config?.gradientColors
    });

    if (configJson !== this.previousConfigJson) {
      this.previousConfigJson = configJson;
      this.initConfig();
      this.loadData();
    }
  }

  ngOnDestroy() {
    this.clearRealtime();
    this.clearReplayInterval();
    this.destroyChart();
  }

  private initConfig() {
    if (this.config) {
      if (!this.config.timeWindow) {
        this.config.timeWindow = 'lastHour';
      }
      this.localTimeWindow = this.config.timeWindow;
    }
  }

  onTimeWindowChange() {
    if (this.config) {
      this.config.timeWindow = this.localTimeWindow;
    }
    this.loadData();
  }

  async loadData() {
    const deviceId = this.getTargetDeviceId();
    const dpX = this.config?.datapointX?.[0];
    const dpY = this.config?.datapointY?.[0];

    if (!dpX || !dpY) {
      this.errorMsg = 'Please configure both X-Axis and Y-Axis data points.';
      this.fullDataset = [];
      return;
    }

    const sourceX = dpX.__target?.id || deviceId;
    const sourceY = dpY.__target?.id || deviceId;

    if (!sourceX || !sourceY) {
      this.errorMsg = 'Target device could not be resolved from selection or dashboard context.';
      this.fullDataset = [];
      return;
    }

    this.errorMsg = null;
    this.loading = true;
    this.exitReplay();
    this.clearRealtime();
    this.destroyChart();

    const { dateFrom, dateTo } = this.calculateDateRange();

    try {
      const isAggregated = !!this.config.aggregation?.active;

      if (isAggregated) {
        const aggType = this.config.aggregation.type || 'avg';
        const aggInterval = this.config.aggregation.interval || 'MINUTELY';
        const valueKey = aggType === 'avg' ? 'value' : aggType;

        // Fetch aggregation series from both sources in parallel
        const [responseX, responseY] = await Promise.all([
          this.measurementService.listSeries({
            source: sourceX,
            series: [`${dpX.fragment}.${dpX.series}`],
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            aggregationType: aggInterval
          }),
          this.measurementService.listSeries({
            source: sourceY,
            series: [`${dpY.fragment}.${dpY.series}`],
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            aggregationType: aggInterval
          })
        ]);

        const valuesX = responseX.data?.values || {};
        const valuesY = responseY.data?.values || {};
        const alignedPoints: any[] = [];

        Object.entries(valuesX).forEach(([timestamp, valArrayX]: [string, any]) => {
          const valArrayY = valuesY[timestamp];
          if (valArrayX && valArrayY) {
            const xObj = valArrayX[0] as any;
            const yObj = valArrayY[0] as any;

            if (
              xObj && yObj &&
              xObj[valueKey] !== undefined && xObj[valueKey] !== null &&
              yObj[valueKey] !== undefined && yObj[valueKey] !== null
            ) {
              const timeMs = new Date(timestamp).getTime();
              alignedPoints.push([
                Number(xObj[valueKey]),
                Number(yObj[valueKey]),
                timeMs,
                new Date(timestamp).toLocaleString()
              ]);
            }
          }
        });
        this.fullDataset = alignedPoints.sort((a, b) => a[2] - b[2]);
      } else {
        // Raw data mode - fetches all measurements in page for both sources in parallel
        const [responseX, responseY] = await Promise.all([
          this.measurementService.list({
            source: sourceX,
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            pageSize: 2000
          }),
          this.measurementService.list({
            source: sourceY,
            dateFrom: dateFrom.toISOString(),
            dateTo: dateTo.toISOString(),
            pageSize: 2000
          })
        ]);

        const measurementsX = responseX.data || [];
        const measurementsY = responseY.data || [];

        const xMap = new Map<string, { val: number; timeMs: number }>();
        const yMap = new Map<string, { val: number; timeMs: number }>();

        measurementsX.forEach((m: any) => {
          const timeStr = m.time;
          if (!timeStr) return;
          const val = m[dpX.fragment]?.[dpX.series]?.value;
          if (val !== undefined && val !== null) {
            xMap.set(timeStr, { val: Number(val), timeMs: new Date(timeStr).getTime() });
          }
        });

        measurementsY.forEach((m: any) => {
          const timeStr = m.time;
          if (!timeStr) return;
          const val = m[dpY.fragment]?.[dpY.series]?.value;
          if (val !== undefined && val !== null) {
            yMap.set(timeStr, { val: Number(val), timeMs: new Date(timeStr).getTime() });
          }
        });

        const matchedPoints: any[] = [];
        xMap.forEach((entryX, timeStr) => {
          const entryY = yMap.get(timeStr);
          if (entryY) {
            matchedPoints.push([
              entryX.val,
              entryY.val,
              entryX.timeMs,
              new Date(timeStr).toLocaleString()
            ]);
          }
        });

        // Fallback matched pairs within 5-sec buffer window
        if (matchedPoints.length === 0) {
          const xList = Array.from(xMap.values());
          const yList = Array.from(yMap.values());

          xList.forEach((xp) => {
            let nearestY: any = null;
            let minDiff = 5000; // 5-second window
            
            yList.forEach((yp) => {
              const diff = Math.abs(xp.timeMs - yp.timeMs);
              if (diff < minDiff) {
                minDiff = diff;
                nearestY = yp;
              }
            });

            if (nearestY) {
              matchedPoints.push([
                xp.val,
                nearestY.val,
                xp.timeMs,
                new Date(xp.timeMs).toLocaleString()
              ]);
            }
          });
        }

        this.fullDataset = matchedPoints.sort((a, b) => a[2] - b[2]);
      }

      // Trigger ECharts rendering and progress setting after DOM has rendered with fullDataset max limits
      setTimeout(() => {
        this.replayProgress = this.fullDataset.length;
        this.updateReplayHUD();
        this.initChart();
        this.setupRealtime();
      }, 50);

    } catch (e) {
      console.error('Failed to load Scatter Plot widget data:', e);
      this.errorMsg = 'Error loading measurement series.';
      this.fullDataset = [];
    } finally {
      this.loading = false;
      this.changeRef.detectChanges();
    }
  }

  private setupRealtime() {
    const deviceId = this.getTargetDeviceId();
    const dpX = this.config?.datapointX?.[0];
    const dpY = this.config?.datapointY?.[0];

    if (!dpX || !dpY || this.config?.aggregation?.active) return;

    const sourceX = dpX.__target?.id || deviceId;
    const sourceY = dpY.__target?.id || deviceId;

    if (!sourceX || !sourceY) return;

    this.clearRealtime();

    const handleEvent = (msg: any, isX: boolean) => {
      let measurement = msg;
      if (msg && msg.data) {
        measurement = msg.data.data ? msg.data.data : msg.data;
      }
      if (!measurement) return;

      const timeStr = measurement.time;
      if (!timeStr) return;
      const timeMs = new Date(timeStr).getTime();

      let modified = false;

      if (isX) {
        const xVal = measurement[dpX.fragment]?.[dpX.series]?.value;
        if (xVal !== undefined && xVal !== null) {
          this.latestX = { value: Number(xVal), timeMs };
          modified = true;
        }
      } else {
        const yVal = measurement[dpY.fragment]?.[dpY.series]?.value;
        if (yVal !== undefined && yVal !== null) {
          this.latestY = { value: Number(yVal), timeMs };
          modified = true;
        }
      }

      // Check alignment criteria (within 5 seconds)
      if (modified && this.latestX && this.latestY) {
        const diff = Math.abs(this.latestX.timeMs - this.latestY.timeMs);
        if (diff <= 5000) {
          const matchedTime = Math.max(this.latestX.timeMs, this.latestY.timeMs);
          const alignedPoint = [
            this.latestX.value,
            this.latestY.value,
            matchedTime,
            new Date(matchedTime).toLocaleString()
          ];

          // Duplication safeguard
          if (!this.fullDataset.some(pt => pt[2] === matchedTime)) {
            this.fullDataset.push(alignedPoint);
            this.pruneAndSortDataset();
            
            // If the user isn't scrubbing back in replay, auto-update the slider
            if (!this.replayActive && this.replayProgress >= this.fullDataset.length - 1) {
              this.replayProgress = this.fullDataset.length;
            }
            this.updateReplayHUD();
            this.updateChartData();
            this.changeRef.detectChanges();
          }

          this.latestX = null;
          this.latestY = null;
        }
      }
    };

    // Initialize real-time streams
    this.realtimeSubX = this.measurementRealtime.onCreate$(sourceX).subscribe((msg: any) => handleEvent(msg, true));
    if (sourceX !== sourceY) {
      this.realtimeSubY = this.measurementRealtime.onCreate$(sourceY).subscribe((msg: any) => handleEvent(msg, false));
    } else {
      // If same device, the single stream handles both axes
      this.realtimeSubY = this.measurementRealtime.onCreate$(sourceX).subscribe((msg: any) => {
        handleEvent(msg, true);
        handleEvent(msg, false);
      });
    }
  }

  private pruneAndSortDataset() {
    this.fullDataset.sort((a, b) => a[2] - b[2]);

    // Prune dataset to last 2000 points to keep ECharts performance light and snappy
    if (this.fullDataset.length > 2000) {
      this.fullDataset = this.fullDataset.slice(this.fullDataset.length - 2000);
    }
  }

  private clearRealtime() {
    if (this.realtimeSubX) {
      this.realtimeSubX.unsubscribe();
      this.realtimeSubX = undefined;
    }
    if (this.realtimeSubY) {
      this.realtimeSubY.unsubscribe();
      this.realtimeSubY = undefined;
    }
    this.latestX = null;
    this.latestY = null;
  }

  private calculateDateRange(): { dateFrom: Date; dateTo: Date } {
    const dateTo = new Date();
    const dateFrom = new Date();
    const windowMode = this.localTimeWindow || 'lastHour';

    switch (windowMode) {
      case 'lastMinute':
        dateFrom.setMinutes(dateTo.getMinutes() - 1);
        break;
      case 'lastHour':
        dateFrom.setHours(dateTo.getHours() - 1);
        break;
      case 'last2Hours':
        dateFrom.setHours(dateTo.getHours() - 2);
        break;
      case 'last4Hours':
        dateFrom.setHours(dateTo.getHours() - 4);
        break;
      case 'last8Hours':
        dateFrom.setHours(dateTo.getHours() - 8);
        break;
      case 'lastDay':
        dateFrom.setDate(dateTo.getDate() - 1);
        break;
      default:
        dateFrom.setHours(dateTo.getHours() - 1);
    }
    return { dateFrom, dateTo };
  }

  // --- ECharts Visual Engine ---

  private initChart() {
    if (!this.chartContainer || this.fullDataset.length === 0) return;

    this.destroyChart();

    this.myChart = echarts.init(this.chartContainer.nativeElement);
    this.updateChartData();

    this.resizeObserver = new ResizeObserver(() => {
      this.myChart?.resize();
    });
    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  private updateChartData() {
    if (!this.myChart) return;

    const dpX = this.config?.datapointX?.[0];
    const dpY = this.config?.datapointY?.[0];
    if (!dpX || !dpY) return;

    const xLabel = dpX.label || dpX.series || 'X-Axis';
    const yLabel = dpY.label || dpY.series || 'Y-Axis';
    const xUnit = dpX.unit ? ` (${dpX.unit})` : '';
    const yUnit = dpY.unit ? ` (${dpY.unit})` : '';

    // Filter points based on the Replay player's timeline progress
    const visiblePoints = this.fullDataset.slice(0, this.replayProgress);

    // Calculate dynamic visual limits
    const timeStamps = this.fullDataset.map(d => d[2]);
    const minTime = timeStamps.length > 0 ? Math.min(...timeStamps) : Date.now() - 3600000;
    const maxTime = timeStamps.length > 0 ? Math.max(...timeStamps) : Date.now();

    const gradientColors = this.config?.gradientColors || ['#3b82f6', '#ef4444'];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: {
          color: '#1e293b',
          fontSize: 12
        },
        formatter: (params: any) => {
          const pt = params.data;
          if (!pt) return '';
          return `
            <div style="font-family: Outfit, sans-serif; padding: 4px;">
              <div style="font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px; font-size: 11px; color: #64748b;">
                <i class="c8y-icon c8y-icon-clock-o"></i> ${pt[3]}
              </div>
              <div style="margin-bottom: 2px;">
                <span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${params.color};"></span>
                <strong>${xLabel}:</strong> ${pt[0]} ${dpX.unit || ''}
              </div>
              <div>
                <span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;background-color:${params.color};"></span>
                <strong>${yLabel}:</strong> ${pt[1]} ${dpY.unit || ''}
              </div>
            </div>
          `;
        }
      },
      grid: {
        top: 25,
        left: 20,
        right: 80,
        bottom: 40,
        containLabel: true
      },
      xAxis: {
        type: 'value',
        name: xLabel,
        nameLocation: 'center',
        nameGap: 28,
        scale: true,
        min: dpX.min !== undefined && dpX.min !== null ? Number(dpX.min) : undefined,
        max: dpX.max !== undefined && dpX.max !== null ? Number(dpX.max) : undefined,
        nameTextStyle: {
          fontWeight: 600,
          color: '#475569',
          fontFamily: 'Outfit, sans-serif'
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#e2e8f0'
          }
        },
        axisLabel: {
          color: '#64748b',
          fontFamily: 'Outfit, sans-serif'
        }
      },
      yAxis: {
        type: 'value',
        name: yLabel,
        nameLocation: 'center',
        nameGap: 36,
        scale: true,
        min: dpY.min !== undefined && dpY.min !== null ? Number(dpY.min) : undefined,
        max: dpY.max !== undefined && dpY.max !== null ? Number(dpY.max) : undefined,
        nameTextStyle: {
          fontWeight: 600,
          color: '#475569',
          fontFamily: 'Outfit, sans-serif'
        },
        splitLine: {
          show: true,
          lineStyle: {
            type: 'dashed',
            color: '#e2e8f0'
          }
        },
        axisLabel: {
          color: '#64748b',
          fontFamily: 'Outfit, sans-serif'
        }
      },
      visualMap: {
        type: 'continuous',
        min: minTime,
        max: maxTime,
        dimension: 2, // Maps timeline to color gradient (dimension 2 is timestampMs)
        calculable: true,
        inRange: {
          color: gradientColors
        },
        right: 0,
        top: 'center',
        itemHeight: 120,
        itemWidth: 14,
        text: ['Newer', 'Older'],
        textStyle: {
          color: '#64748b',
          fontWeight: 500,
          fontSize: 10,
          fontFamily: 'Outfit, sans-serif'
        },
        formatter: (value: any) => {
          const date = new Date(Number(value));
          return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
      },
      series: [
        {
          name: 'Measurements Correlation',
          type: 'scatter',
          symbolSize: 10,
          data: visiblePoints,
          animation: false,
          itemStyle: {
            opacity: 0.85,
            shadowBlur: 6,
            shadowColor: 'rgba(0,0,0,0.15)'
          }
        }
      ]
    };

    this.myChart.setOption(option);
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

  // --- Live Replay Control Center ---

  toggleReplay() {
    if (this.replayActive) {
      this.pauseReplay();
    } else {
      this.startReplay();
    }
  }

  startReplay() {
    this.clearReplayInterval();

    this.replayActive = true;
    
    // Loop reset fallback
    if (this.replayProgress >= this.fullDataset.length) {
      this.replayProgress = 1;
    }

    const intervalMs = Math.max(50, 1000 / this.replaySpeed);

    this.replayIntervalId = setInterval(() => {
      if (this.replayProgress < this.fullDataset.length) {
        this.replayProgress++;
        this.updateReplayHUD();
        this.updateChartData();
      } else {
        this.pauseReplay();
      }
      this.changeRef.detectChanges();
    }, intervalMs);
    
    this.changeRef.detectChanges();
  }

  pauseReplay() {
    this.replayActive = false;
    this.clearReplayInterval();
    this.changeRef.detectChanges();
  }

  onSliderInput(event: any) {
    this.replayProgress = Number(event.target.value);
    this.onScrub();
  }

  onScrub() {
    this.pauseReplay();
    this.updateReplayHUD();
    this.updateChartData();
  }

  onSpeedChange() {
    if (this.replayActive) {
      this.startReplay(); // restart interval with new speed configuration
    }
  }

  exitReplay() {
    this.pauseReplay();
    this.replayProgress = this.fullDataset.length;
    this.updateReplayHUD();
    this.updateChartData();
  }

  private clearReplayInterval() {
    if (this.replayIntervalId) {
      clearInterval(this.replayIntervalId);
      this.replayIntervalId = null;
    }
  }

  private updateReplayHUD() {
    const idx = Math.min(this.replayProgress - 1, this.fullDataset.length - 1);
    if (this.fullDataset[idx]) {
      this.currentReplayTimeStr = this.fullDataset[idx][3];
    } else {
      this.currentReplayTimeStr = 'N/A';
    }
  }

  getTargetDeviceId(): string | null {
    if (this.config?.device?.id) {
      return this.config.device.id;
    }
    if (this.dashboardChild?.data?.id) {
      return this.dashboardChild.data.id;
    }
    if (this.config?.datapointX?.[0]?.__target?.id) {
      return this.config.datapointX[0].__target.id;
    }
    return null;
  }

  getDeviceName(): string {
    const dpX = this.config?.datapointX?.[0];
    const dpY = this.config?.datapointY?.[0];

    const nameX = dpX?.__target?.name || 'Device X';
    const nameY = dpY?.__target?.name || 'Device Y';

    if (nameX === nameY) {
      if (nameX === 'Device X') {
        if (this.config?.device?.name) return this.config.device.name;
        if (this.dashboardChild?.data?.name) return this.dashboardChild.data.name;
      }
      return nameX;
    }
    return `${nameX} / ${nameY}`;
  }
}
