/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, OnChanges, SimpleChanges, inject, ViewChild, DoCheck, ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DashboardChildComponent, WidgetTimeContextDateRangeService } from '@c8y/ngx-components';
import { 
  ChartsComponent,
  CHART_VIEW_CONTEXT, 
  ChartAlarmsService, 
  ChartEventsService, 
  ChartHelpersService 
} from '@c8y/ngx-components/echart';
import { AlarmSeverityToIconPipe, AlarmSeverityToLabelPipe } from '@c8y/ngx-components/alarms';
import {
  DisplayMode,
  GlobalContextState,
  GLOBAL_CONTEXT_DISPLAY_MODE,
  PRESET_NAME
} from '@c8y/ngx-components/global-context';

@Component({
    selector: 'lib-stacked-bar-chart-widget',
    standalone: false,
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

      <!-- Cumulocity IoT Charts component rendering -->
      <div style="flex: 1 1 auto; position: relative; min-height: 0; width: 100%;">
        <c8y-charts
          *ngIf="chartsConfig?.datapoints?.length > 0"
          [config]="chartsConfig"
          [chartViewContext]="CHART_VIEW_CONTEXT.WIDGET_VIEW"
          (finishLoading)="onFinishLoading($event)"
        ></c8y-charts>
      </div>
    </div>
  `,
})
export class StackedBarChartWidgetComponent implements OnInit, OnChanges, DoCheck {
    @Input() config: any;

    @ViewChild(ChartsComponent) private chartsComponent!: ChartsComponent;

    // Inject DashboardChildComponent optionally to avoid runtime crash inside widget config preview
    private dashboardChild = inject(DashboardChildComponent, { optional: true });
    private elementRef = inject(ElementRef);

    displayMode: DisplayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
    readonly CHART_VIEW_CONTEXT = CHART_VIEW_CONTEXT;
    readonly GLOBAL_CONTEXT_DISPLAY_MODE = GLOBAL_CONTEXT_DISPLAY_MODE;
    readonly PRESET_NAME = PRESET_NAME;

    contextConfig: GlobalContextState = {};
    chartsConfig: any = {};
    isLoading = false;
    isLinkedToGlobal: boolean = true;

    ngOnInit() {
        this.initContext();
        this.updateChartsConfig();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['config'] && changes['config'].currentValue) {
            this.initContext(changes['config'].currentValue);
            this.updateChartsConfig();
        }
    }

    ngDoCheck() {
        if (this.chartsComponent?.echartsInstance) {
            const echarts = this.chartsComponent.echartsInstance;
            if (!(echarts.setOption as any).isWrapped) {
                this.setupEchartsInterception();
                this.applyStacking();
            }
        }
    }

    private initContext(config = this.config) {
        const {
            displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD,
            dateTimeContext,
            aggregation,
            isAutoRefreshEnabled,
            refreshInterval,
            refreshOption,
            dateContext
        } = config || {};

        this.displayMode = displayMode as DisplayMode;
        
        // If we default to DASHBOARD mode but no dashboard context is present (e.g. inside widget config preview),
        // fallback to CONFIG mode to prevent c8y-global-context-connector from crashing on null dashboard child.
        const hasDashboardChildData = this.dashboardChild && this.dashboardChild.data && this.dashboardChild.data.id;
        if (this.displayMode === GLOBAL_CONTEXT_DISPLAY_MODE.DASHBOARD && !hasDashboardChildData) {
            this.displayMode = GLOBAL_CONTEXT_DISPLAY_MODE.CONFIG;
        }

        // Always default to linked (dashboard mode) on load / config initialization
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
        this.contextConfig = event?.context || event || {};
        if (event && typeof event.linked === 'boolean') {
            this.isLinkedToGlobal = event.linked;
        }
        this.updateChartsConfig();
    }

    onRefresh(): void {
        this.updateChartsConfig();
    }

    onFinishLoading(success: boolean) {
        this.isLoading = false;
        if (success && this.chartsComponent?.echartsInstance) {
            this.setupEchartsInterception();
            this.applyStacking();
        }
    }

    getDashboardChild(): DashboardChildComponent | null {
        return this.dashboardChild;
    }

    private setupEchartsInterception() {
        const echarts = this.chartsComponent?.echartsInstance;
        if (!echarts) return;

        if ((echarts.setOption as any).isWrapped) {
            return;
        }

        const originalSetOption = echarts.setOption.bind(echarts);

        echarts.setOption = function(option: any, ...args: any[]) {
            if (option) {
                if (option.series && option.series.length > 0) {
                    // 1. Gather all unique timestamps (as numbers) across all bar series
                    const timestampMap = new Map<number, string>(); // timeNum -> originalTimeStr
                    option.series.forEach((s: any) => {
                        if (s.type === 'bar' && Array.isArray(s.data)) {
                            s.data.forEach((item: any) => {
                                let rawTime: any = null;
                                if (Array.isArray(item)) {
                                    rawTime = item[0];
                                } else if (item && item.value && Array.isArray(item.value)) {
                                    rawTime = item.value[0];
                                } else if (item && typeof item === 'object') {
                                    rawTime = item.name || item.time;
                                }
                                if (rawTime !== null && rawTime !== undefined) {
                                    const timeNum = new Date(rawTime).getTime();
                                    if (!isNaN(timeNum)) {
                                        timestampMap.set(timeNum, rawTime);
                                    }
                                }
                            });
                        }
                    });

                    // 2. Sort the timestamps chronologically
                    const sortedTimeNums = Array.from(timestampMap.keys()).sort((a, b) => a - b);

                    // 3. For each series, map existing values by time number
                    option.series = option.series.map((s: any) => {
                        if (s.type === 'bar') {
                            const valueMap = new Map<number, any>();
                            if (Array.isArray(s.data)) {
                                s.data.forEach((item: any) => {
                                    let rawTime: any = null;
                                    let val: any = null;
                                    if (Array.isArray(item)) {
                                        rawTime = item[0];
                                        val = item[1];
                                    } else if (item && item.value && Array.isArray(item.value)) {
                                        rawTime = item.value[0];
                                        val = item.value[1];
                                    } else if (item && typeof item === 'object') {
                                        rawTime = item.name || item.time;
                                        val = item.value;
                                    }
                                    if (rawTime !== null && rawTime !== undefined) {
                                        const timeNum = new Date(rawTime).getTime();
                                        if (!isNaN(timeNum)) {
                                            valueMap.set(timeNum, val);
                                        }
                                    }
                                });
                            }

                            // 4. Reconstruct s.data using sortedTimeNums, fallback to 0 for missing values
                            const newData = sortedTimeNums.map((timeNum: number) => {
                                const val = valueMap.has(timeNum) ? valueMap.get(timeNum) : 0;
                                const originalTimeStr = timestampMap.get(timeNum);
                                return [originalTimeStr, val];
                            });

                            return {
                                ...s,
                                data: newData,
                                stack: 'total', // force stacking on all bar series
                                yAxisIndex: 0   // force all series onto the first Y-axis
                            };
                        }
                        return s;
                    });
                }
                if (option.xAxis && Array.isArray(option.xAxis)) {
                    option.xAxis = option.xAxis.map((xConfig: any) => {
                        return {
                            ...xConfig,
                            axisLine: {
                                show: true,
                                lineStyle: { color: '#ccc' }
                            },
                            axisTick: {
                                show: true,
                                lineStyle: { color: '#ccc' }
                            },
                            axisLabel: {
                                show: true,
                                color: '#666'
                            },
                            splitLine: {
                                show: true,
                                lineStyle: { color: '#eee', type: 'solid' }
                            }
                        };
                    });
                }
                if (option.grid) {
                    if (Array.isArray(option.grid)) {
                        option.grid = option.grid.map((g: any) => ({
                            ...g,
                            right: 20 // Reset right padding to reclaim full width
                        }));
                    } else if (typeof option.grid === 'object') {
                        option.grid.right = 20;
                    }
                }
                if (option.yAxis && Array.isArray(option.yAxis) && option.yAxis.length > 0) {
                    const yAxisConfig = { ...option.yAxis[0] };
                    // Reset min to 0, delete max, and clear the name/label
                    yAxisConfig.min = 0;
                    delete yAxisConfig.max;
                    delete yAxisConfig.name;

                    // Remove series color from all Y-axis elements by enforcing neutral colors
                    yAxisConfig.axisLine = {
                        show: true,
                        lineStyle: { color: '#ccc' }
                    };
                    yAxisConfig.axisTick = {
                        show: true,
                        lineStyle: { color: '#ccc' }
                    };
                    yAxisConfig.axisLabel = {
                        show: true,
                        color: '#666'
                    };
                    yAxisConfig.splitLine = {
                        show: true,
                        lineStyle: { color: '#eee', type: 'dashed' }
                    };

                    option.yAxis = [yAxisConfig];
                }
            }
            return originalSetOption(option, ...args);
        };

        (echarts.setOption as any).isWrapped = true;
    }

    private applyStacking() {
        const echarts = this.chartsComponent?.echartsInstance;
        if (!echarts) return;

        this.setupEchartsInterception();
        const currentOptions = echarts.getOption() as any;
        if (currentOptions) {
            // Use notMerge = true (second argument) to force ECharts to reconstruct 
            // the series with the new 'stack' properties instead of merging them with old ones.
            echarts.setOption(currentOptions, true);
        }
    }

    private updateChartsConfig() {
        if (this.elementRef?.nativeElement) {
            this.elementRef.nativeElement.widgetInstance = this;
        }

        // Save to window for debugging
        if (!(window as any).stackedWidgets) {
            (window as any).stackedWidgets = [];
        }
        if (!(window as any).stackedWidgets.includes(this)) {
            (window as any).stackedWidgets.push(this);
        }

        if (!this.config?.datapoints || this.config.datapoints.length === 0) {
            this.chartsConfig = {};
            return;
        }

        const dateFrom = this.contextConfig.dateTimeContext?.dateFrom || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const dateTo = this.contextConfig.dateTimeContext?.dateTo || new Date().toISOString();

        // Mapping datapoints to force 'bars' visualization type and keep active
        const datapoints = (this.config.datapoints || []).map((dp: any) => ({
            ...dp,
            lineType: 'bars',
            __active: true
        }));

        const chartsDisplayMode = this.displayMode;

        this.chartsConfig = {
            datapoints,
            dateFrom,
            dateTo,
            displayAggregationSelection: false,
            displayDateSelection: false,
            showSlider: false,
            realtime: this.contextConfig.refreshOption === 'live',
            isRealtimeEnabled: this.contextConfig.refreshOption === 'live',
            dateTimeContext: this.contextConfig.dateTimeContext,
            displayMode: chartsDisplayMode,
            isAutoRefreshEnabled: this.contextConfig.isAutoRefreshEnabled,
            refreshOption: this.contextConfig.refreshOption,
            refreshInterval: this.contextConfig.refreshInterval,
            xAxisSplitLines: true,
            yAxisSplitLines: true,
            aggregation: this.contextConfig.aggregation,
            numberOfDecimalPlaces: 2
        };
    }
}
