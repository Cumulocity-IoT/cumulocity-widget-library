/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnDestroy, OnInit, ViewChild, OnChanges, SimpleChanges, inject, DoCheck, ElementRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CoreModule, WidgetTimeContextDateRangeService } from '@c8y/ngx-components';
import { DashboardChildComponent } from '@c8y/ngx-components';
import { ChartsComponent, CHART_VIEW_CONTEXT, ChartAlarmsService, ChartEventsService, ChartHelpersService } from '@c8y/ngx-components/echart';
import { AlarmSeverityToIconPipe, AlarmSeverityToLabelPipe } from '@c8y/ngx-components/alarms';
import {
  DisplayMode,
  GlobalContextState,
  GLOBAL_CONTEXT_DISPLAY_MODE,
  PRESET_NAME,
  REFRESH_OPTION,
  GlobalContextConnectorComponent,
  LocalControlsComponent
} from '@c8y/ngx-components/global-context';
import { durationToMilliseconds, runTrendAnalysis } from './trend-analysis/trend-math';
import { TrendConfig, TrendForecastResult } from './trend-analysis/trend.model';

@Component({
  selector: 'lib-spc-chart-widget',
  standalone: false,
  host: {
    style: 'display: block; height: 100%; width: 100%;'
  },
  providers: [
    DatePipe,
    AlarmSeverityToIconPipe,
    AlarmSeverityToLabelPipe,
    WidgetTimeContextDateRangeService,
    ChartAlarmsService,
    ChartEventsService,
    ChartHelpersService
  ],
  template: `
    <div style="display: flex; flex-direction: column; height: 100%; width: 100%;">
      <!-- Global Time Context Connector for Dashboard Mode -->
      <c8y-global-context-connector
        *ngIf="displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD"
        [controls]="PRESET_NAME.DEFAULT"
        [config]="contextConfig"
        [isLoading]="isLoading"
        [dashboardChild]="getDashboardChild()"
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

      <div style="flex: 1 1 auto; position: relative; min-height: 0; width: 100%;">
        <c8y-charts
          *ngIf="chartsConfig && chartsConfig.datapoints && chartsConfig.datapoints.length > 0"
          [config]="chartsConfig"
          [chartViewContext]="CHART_VIEW_CONTEXT.WIDGET_VIEW"
          (finishLoading)="onFinishLoading($event)"
        ></c8y-charts>
      </div>
    </div>
  `,
})
export class SpcChartWidgetComponent implements OnInit, OnDestroy, OnChanges, DoCheck {
  @Input() config: any;

  @ViewChild(ChartsComponent) private chartsComponent!: ChartsComponent;

  private dashboardChild = inject(DashboardChildComponent, { optional: true });
  private elementRef = inject(ElementRef);

  displayMode: DisplayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
  readonly CHART_VIEW_CONTEXT = CHART_VIEW_CONTEXT;
  contextConfig: GlobalContextState = {};
  isLoading = false;
  isLinkedToGlobal: boolean = true;

  chartsConfig: any = {};

  readonly GLOBAL_CONTEXT_DISPLAY_MODE = GLOBAL_CONTEXT_DISPLAY_MODE;
  readonly PRESET_NAME = PRESET_NAME;

  private previousDatapointsJson = '';
  private previousStaticLinesJson = '';
  private previousAreasJson = '';
  private previousTrendConfigJson = '';

  private rawBaseSeries: any[] = [];

  ngOnInit() {
    const {
      displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD,
      dateTimeContext,
      aggregation,
      isAutoRefreshEnabled,
      refreshInterval,
      refreshOption,
      dateContext
    } = this.config || {};

    this.displayMode = displayMode as DisplayMode;
    const hasDashboardChildData = this.dashboardChild && this.dashboardChild.data && this.dashboardChild.data.id;
    if (this.displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD && !hasDashboardChildData) {
      this.displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
    }
    
    this.isLinkedToGlobal = dateContext !== 'widget';

    this.contextConfig = {
      dateTimeContext,
      aggregation,
      isAutoRefreshEnabled,
      refreshInterval,
      refreshOption
    };

    this.updateChartsConfig();
  }

  ngDoCheck() {
    const datapointsJson = JSON.stringify(this.config?.datapoints || []);
    const staticLinesJson = JSON.stringify(this.config?.staticLines || []);
    const areasJson = JSON.stringify(this.config?.areas || []);
    const trendConfigJson = JSON.stringify(this.config?.trendConfig || {});

    if (this.chartsComponent?.echartsInstance) {
      this.setupEchartsInterception();
    }

    if (
      datapointsJson !== this.previousDatapointsJson ||
      staticLinesJson !== this.previousStaticLinesJson ||
      areasJson !== this.previousAreasJson ||
      trendConfigJson !== this.previousTrendConfigJson
    ) {
      this.previousDatapointsJson = datapointsJson;
      this.previousStaticLinesJson = staticLinesJson;
      this.previousAreasJson = areasJson;
      this.previousTrendConfigJson = trendConfigJson;
      this.updateChartsConfig();
      if (this.chartsComponent?.echartsInstance) {
        setTimeout(() => {
          this.applySpcAnnotations();
        }, 50);
      }
    }
  }

  onContextChange(event: any): void {
    this.contextConfig = event?.context || event || {};
    if (event && typeof event.linked === 'boolean') {
      this.isLinkedToGlobal = event.linked;
    }
    this.updateChartsConfig();
  }

  onRefresh(): void {
    this.updateChartsConfig();
  }

  getDashboardChild(): any {
    return this.dashboardChild;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && changes['config'].currentValue) {
      const currentConfig = changes['config'].currentValue;
      const {
        displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD,
        dateTimeContext,
        aggregation,
        isAutoRefreshEnabled,
        refreshInterval,
        refreshOption,
        dateContext
      } = currentConfig;

      this.displayMode = displayMode as DisplayMode;
      const hasDashboardChildData = this.dashboardChild && this.dashboardChild.data && this.dashboardChild.data.id;
      if (this.displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD && !hasDashboardChildData) {
        this.displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
      }
      
      this.isLinkedToGlobal = dateContext !== 'widget';

      this.contextConfig = {
        dateTimeContext,
        aggregation,
        isAutoRefreshEnabled,
        refreshInterval,
        refreshOption
      };
      this.updateChartsConfig();
    }
  }

  ngOnDestroy() {}

  private updateChartsConfig() {
    if (this.elementRef?.nativeElement) {
      this.elementRef.nativeElement.widgetInstance = this;
    }

    // Save to window for debugging
    if (!(window as any).spcWidgets) {
      (window as any).spcWidgets = [];
    }
    if (!(window as any).spcWidgets.includes(this)) {
      (window as any).spcWidgets.push(this);
    }

    if (!this.config?.datapoints || this.config.datapoints.length === 0) {
      this.chartsConfig = {};
      return;
    }

    const dateFrom = this.contextConfig.dateTimeContext?.dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dateTo = this.contextConfig.dateTimeContext?.dateTo || new Date().toISOString();

    const datapoints = (this.config.datapoints || []).map((dp: any) => ({
      ...dp,
      __active: true
    }));

    // Build the native DatapointsGraphWidgetConfig configuration
    this.chartsConfig = {
      datapoints: datapoints,
      dateFrom: dateFrom,
      dateTo: dateTo,
      displayAggregationSelection: false,
      displayDateSelection: false,
      showSlider: false,
      isRealtimeEnabled: this.contextConfig.refreshOption === REFRESH_OPTION.LIVE,
      realtime: this.contextConfig.refreshOption === REFRESH_OPTION.LIVE,
      dateTimeContext: this.contextConfig.dateTimeContext,
      aggregation: this.contextConfig.aggregation,
      isAutoRefreshEnabled: this.contextConfig.isAutoRefreshEnabled,
      refreshOption: this.contextConfig.refreshOption,
      displayMode: this.displayMode,
      refreshInterval: this.contextConfig.refreshInterval,
      xAxisSplitLines: true,
      yAxisSplitLines: true
    };
  }

  onFinishLoading(success: boolean) {
    this.isLoading = false;
    if (success && this.chartsComponent?.echartsInstance) {
      setTimeout(() => {
        this.setupEchartsInterception();
        this.applySpcAnnotations();
      }, 50);
    }
  }

  private setupEchartsInterception() {
    const echarts = this.chartsComponent?.echartsInstance;
    if (!echarts) return;

    if ((echarts.setOption as any).isWrapped) {
      return;
    }

    const originalSetOption = echarts.setOption.bind(echarts);
    const self = this;

    echarts.setOption = function(option: any, ...args: any[]) {
      if (option && option.series && option.series.length > 0) {
        // Filter helper functions
        const isForecastOrHelperSeries = (s: any) => {
          if (!s) return false;
          if (s.__isTrendForecast || s.__isConfidenceBand) return true;
          const name = typeof s.name === 'string' ? s.name : '';
          return name.includes('(Trend Forecast)') || name.includes('Confidence Band') || name.includes(' Lower');
        };

        const isDummyOrAggregated = (s: any) => {
          if (!s) return true;
          if (s.id === 'aggregated-empty' || s.datapointId === 'aggregated' || s.typeOfSeries === 'fake') return true;
          return false;
        };

        const isAlarmOrEvent = (s: any) => {
          if (!s) return false;
          if (s.typeOfSeries === 'alarm' || s.typeOfSeries === 'event') return true;
          const name = typeof s.name === 'string' ? s.name : '';
          return name.endsWith('-markPoint') || name.endsWith('-markLine');
        };

        const currentBaseSeries = option.series.filter((s: any) => !isForecastOrHelperSeries(s));
        if (currentBaseSeries.length > 0) {
          self.rawBaseSeries = currentBaseSeries;
        }
        const baseSeries = currentBaseSeries.length > 0 ? currentBaseSeries : self.rawBaseSeries;

        // Find actual measurement series (skipping empty aggregated or alarm series)
        const measurementSeries = baseSeries.filter((s: any) => !isDummyOrAggregated(s) && !isAlarmOrEvent(s));

        const markLineData = self.getMarkLineData();
        const markAreaData = self.getMarkAreaData();

        const primaryTarget = measurementSeries.length > 0 ? measurementSeries[0] : baseSeries[0];

        const configuredSeries = baseSeries.map((s: any) => {
          if (s === primaryTarget) {
            return {
              ...s,
              markLine: {
                symbol: 'none',
                data: markLineData
              },
              markArea: {
                data: markAreaData
              }
            };
          }
          return s;
        });

        // Compute and inject Trend Analysis & Forecasting series if enabled
        const trendConfig: TrendConfig | undefined = self.config?.trendConfig;
        if (trendConfig && trendConfig.enabled && measurementSeries.length > 0) {
          const targetIndex = Math.min(
            measurementSeries.length - 1,
            Math.max(0, trendConfig.targetDatapointIndex || 0)
          );
          const targetSeries = measurementSeries[targetIndex];
          const rawPoints = self.extractPointsFromSeries(targetSeries);

          if (rawPoints.length >= 2) {
            const lastRawPoint = rawPoints[rawPoints.length - 1];
            const lastTimestamp = lastRawPoint[0];
            const forecastDurationMs = durationToMilliseconds(
              trendConfig.forecastDuration || 30,
              trendConfig.forecastUnit || 'minutes'
            );

            // Project all the way into the future from the current timeline
            const now = Date.now();
            const targetForecastEnd = Math.max(lastTimestamp, now) + forecastDurationMs;
            const totalForecastSpanMs = Math.max(forecastDurationMs, targetForecastEnd - lastTimestamp);

            const forecastResult = runTrendAnalysis(rawPoints, trendConfig, totalForecastSpanMs);

            if (forecastResult && forecastResult.forecast.length > 0) {
              // Connect from the last real measurement to the forecast timeline
              const forecastLineData: Array<[number, number]> = [
                [lastRawPoint[0], lastRawPoint[1]],
                ...forecastResult.forecast.map(p => [p.timestamp, p.value] as [number, number])
              ];

              const targetName = targetSeries.name || targetSeries.datapointLabel || 'Measurement';
              const trendSeriesName = `${targetName} (Trend Forecast)`;

              const bandColor = trendConfig.color || '#FF7F0E';
              const bandOpacity = trendConfig.confidenceBandOpacity ?? 0.15;

              const trendSeries = {
                id: 'trend-forecast-series',
                name: trendSeriesName,
                __isTrendForecast: true,
                typeOfSeries: 'fake',
                type: 'line',
                data: forecastLineData,
                smooth: trendConfig.method === 'polynomial' || trendConfig.method === 'holt',
                showSymbol: false,
                yAxisIndex: targetSeries.yAxisIndex ?? 0,
                xAxisIndex: targetSeries.xAxisIndex ?? 0,
                datapointLabel: trendSeriesName,
                datapointUnit: targetSeries.datapointUnit || '',
                lineStyle: {
                  color: bandColor,
                  type: trendConfig.lineStyle || 'dashed',
                  width: trendConfig.lineWidth || 2
                },
                itemStyle: {
                  color: bandColor
                },
                z: 10
              };

              configuredSeries.push(trendSeries);

              // Inject Confidence Interval Band if configured
              if (
                trendConfig.showConfidenceBand &&
                forecastResult.forecast[0]?.lowerConfidence !== undefined &&
                forecastResult.forecast[0]?.upperConfidence !== undefined
              ) {
                const lowerBandData: Array<[number, number]> = [
                  [lastRawPoint[0], lastRawPoint[1]],
                  ...forecastResult.forecast.map(p => [p.timestamp, p.lowerConfidence!] as [number, number])
                ];

                const deltaBandData: Array<[number, number]> = [
                  [lastRawPoint[0], 0],
                  ...forecastResult.forecast.map(
                    p => [p.timestamp, Math.max(0, p.upperConfidence! - p.lowerConfidence!)] as [number, number]
                  )
                ];

                const lowerSeries = {
                  id: 'trend-confidence-lower-series',
                  name: `${trendSeriesName} Lower`,
                  __isConfidenceBand: true,
                  typeOfSeries: 'fake',
                  type: 'line',
                  data: lowerBandData,
                  stack: 'trend-confidence-stack',
                  yAxisIndex: targetSeries.yAxisIndex ?? 0,
                  xAxisIndex: targetSeries.xAxisIndex ?? 0,
                  datapointLabel: `${trendSeriesName} Lower`,
                  datapointUnit: targetSeries.datapointUnit || '',
                  lineStyle: { opacity: 0 },
                  itemStyle: { color: bandColor, opacity: 0 },
                  showSymbol: false,
                  silent: true,
                  tooltip: { show: false },
                  z: 5
                };

                const upperDeltaSeries = {
                  id: 'trend-confidence-upper-series',
                  name: `${trendSeriesName} Confidence Band`,
                  __isConfidenceBand: true,
                  typeOfSeries: 'fake',
                  type: 'line',
                  data: deltaBandData,
                  stack: 'trend-confidence-stack',
                  yAxisIndex: targetSeries.yAxisIndex ?? 0,
                  xAxisIndex: targetSeries.xAxisIndex ?? 0,
                  datapointLabel: `${trendSeriesName} Confidence Band`,
                  datapointUnit: targetSeries.datapointUnit || '',
                  areaStyle: {
                    color: bandColor,
                    opacity: bandOpacity
                  },
                  lineStyle: { opacity: 0 },
                  itemStyle: { color: bandColor },
                  showSymbol: false,
                  silent: true,
                  tooltip: { show: false },
                  z: 6
                };

                configuredSeries.push(lowerSeries, upperDeltaSeries);
              }

              // 1. Extend xAxis max so the future timeline is visible on the chart
              if (option.xAxis) {
                const xAxes = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis];
                for (const xAxis of xAxes) {
                  if (xAxis) {
                    xAxis.max = targetForecastEnd;
                  }
                }
              }

              // 2. Extend dataZoom viewport so it does not clip the future timeline
              if (option.dataZoom) {
                const dataZooms = Array.isArray(option.dataZoom) ? option.dataZoom : [option.dataZoom];
                for (const dz of dataZooms) {
                  if (dz) {
                    if (dz.endValue !== undefined && dz.endValue !== null) {
                      dz.endValue = targetForecastEnd;
                    }
                    if (dz.end !== undefined && dz.end !== null) {
                      dz.end = 100;
                    }
                  }
                }
              }
            }
          }
        }

        option.series = configuredSeries;

        // Wrap tooltip formatter to prevent c8y-charts from crashing on injected custom series
        const wrapTooltip = (tt: any) => {
          if (!tt) return;
          const origFormatter = tt.formatter;
          if (!origFormatter || (origFormatter as any).__isWrapped) return;

          const newFormatter = function(params: any, ticket: any, callback: any) {
            const list = Array.isArray(params) ? params : (params ? [params] : []);
            const baseParams = list.filter((p: any) => {
              const sIdx = p.seriesIndex ?? -1;
              return (
                sIdx >= 0 &&
                sIdx < baseSeries.length &&
                !p.seriesName?.includes('(Trend Forecast)') &&
                !p.seriesName?.includes('Confidence Band') &&
                !p.seriesName?.includes('Lower')
              );
            });
            const trendParams = list.filter((p: any) => p.seriesName?.includes('(Trend Forecast)'));

            let output = '';
            if (baseParams.length > 0) {
              try {
                if (typeof origFormatter === 'function') {
                  output = origFormatter(baseParams, ticket, callback) || '';
                } else if (typeof origFormatter === 'string') {
                  output = origFormatter;
                }
              } catch {
                output = '';
              }
            }

            if (trendParams.length > 0) {
              let trendRows = '';
              for (const tp of trendParams) {
                const val = Array.isArray(tp.value)
                  ? tp.value[1]
                  : tp.data && Array.isArray(tp.data)
                  ? tp.data[1]
                  : tp.value;
                const timeVal = Array.isArray(tp.value)
                  ? tp.value[0]
                  : tp.data && Array.isArray(tp.data)
                  ? tp.data[0]
                  : undefined;
                const timeStr = timeVal ? new Date(timeVal).toLocaleString() : '';
                const numStr =
                  typeof val === 'number' ? val.toFixed(2) : val !== undefined ? String(val) : '';
                const color = tp.color || trendConfig?.color || '#FF7F0E';
                const marker = `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${color};"></span>`;
                trendRows += `<div>${marker} ${tp.seriesName}: <b>${numStr}</b></div>`;
                if (!output && timeStr) {
                  output = `<div style="font-size:12px;font-weight:bold;margin-bottom:4px;">${timeStr}</div>`;
                }
              }
              if (trendRows) {
                output = (output ? output + '<br/>' : '') + trendRows;
              }
            }

            return output || '';
          };

          (newFormatter as any).__isWrapped = true;
          tt.formatter = newFormatter;
        };

        if (option.tooltip) {
          if (Array.isArray(option.tooltip)) {
            option.tooltip.forEach(wrapTooltip);
          } else {
            wrapTooltip(option.tooltip);
          }
        }
      }

      return originalSetOption(option, ...args);
    };

    (echarts.setOption as any).isWrapped = true;
  }

  /**
   * Helper to parse series data array into timestamp/value pairs.
   */
  private extractPointsFromSeries(series: any): Array<[number, number]> {
    if (!series || !Array.isArray(series.data)) return [];
    const points: Array<[number, number]> = [];

    for (const item of series.data) {
      let ts: number | undefined;
      let val: number | undefined;

      if (Array.isArray(item)) {
        ts = typeof item[0] === 'number' ? item[0] : new Date(item[0]).getTime();
        val = typeof item[1] === 'number' ? item[1] : (item[1] !== null && item[1] !== undefined ? parseFloat(item[1]) : NaN);
      } else if (item && typeof item === 'object') {
        if (Array.isArray(item.value)) {
          ts = typeof item.value[0] === 'number' ? item.value[0] : new Date(item.value[0]).getTime();
          val = typeof item.value[1] === 'number' ? item.value[1] : (item.value[1] !== null && item.value[1] !== undefined ? parseFloat(item.value[1]) : NaN);
        } else if (item.value !== undefined && item.value !== null) {
          val = typeof item.value === 'number' ? item.value : parseFloat(item.value);
          ts = item.name ? new Date(item.name).getTime() : undefined;
        }
      }

      if (ts !== undefined && val !== undefined && !isNaN(ts) && !isNaN(val) && isFinite(ts) && isFinite(val)) {
        points.push([ts, val]);
      }
    }

    return points.sort((a, b) => a[0] - b[0]);
  }

  private getMarkLineData(): any[] {
    const markLineData: any[] = [];
    const staticLines = this.config.staticLines || [];
    staticLines.forEach((line: any) => {
      if (line.value === undefined || line.value === null) return;
      markLineData.push({
        yAxis: line.value,
        name: line.label || '',
        label: {
          show: true,
          position: 'insideStartTop',
          formatter: line.label || '',
          color: 'var(--c8y-text-color, #333)',
          fontWeight: 'bold',
          fontFamily: 'var(--c8y-font-family-base, inherit)'
        },
        lineStyle: {
          type: 'dashed',
          color: 'var(--c8y-text-muted, #333333)',
          width: 1.5
        }
      });
    });
    return markLineData;
  }

  private getMarkAreaData(): any[] {
    const markAreaData: any[] = [];
    const areas = this.config.areas || [];
    areas.forEach((area: any) => {
      let yAxisStart: any = undefined;
      let yAxisEnd: any = undefined;
      if (area.type === 'upper' && area.value !== undefined) {
        yAxisStart = area.value;
        yAxisEnd = Number.MAX_SAFE_INTEGER;
      } else if (area.type === 'lower' && area.value !== undefined) {
        yAxisStart = Number.MIN_SAFE_INTEGER;
        yAxisEnd = area.value;
      } else if (area.type === 'range' && area.min !== undefined && area.max !== undefined) {
        yAxisStart = area.min;
        yAxisEnd = area.max;
      }

      if (yAxisStart !== undefined && yAxisEnd !== undefined) {
        markAreaData.push([
          {
            yAxis: yAxisStart,
            itemStyle: {
              color: area.color || '#E51A1A',
              opacity: 0.15
            },
            label: {
              show: true,
              position: area.type === 'lower' ? 'insideBottomRight' : 'insideTopRight',
              formatter: area.label || '',
              color: 'var(--c8y-text-color, #333333)',
              fontWeight: 'bold',
              fontSize: 11,
              fontFamily: 'var(--c8y-font-family-base, inherit)'
            }
          },
          {
            yAxis: yAxisEnd
          }
        ]);
      }
    });
    return markAreaData;
  }

  private applySpcAnnotations() {
    const echarts = this.chartsComponent?.echartsInstance;
    if (!echarts) return;

    this.setupEchartsInterception();
    const currentOptions = echarts.getOption() as any;
    if (currentOptions) {
      const clonedOption = {
        ...currentOptions,
        series: currentOptions.series ? [...currentOptions.series] : [],
        xAxis: currentOptions.xAxis ? (Array.isArray(currentOptions.xAxis) ? [...currentOptions.xAxis] : { ...currentOptions.xAxis }) : undefined,
        dataZoom: currentOptions.dataZoom ? (Array.isArray(currentOptions.dataZoom) ? [...currentOptions.dataZoom] : { ...currentOptions.dataZoom }) : undefined
      };
      echarts.setOption(clonedOption, { notMerge: false, replaceMerge: ['series'] });
      echarts.resize();
    }
  }
}
