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
import { AlarmSeverityToIconPipe, AlarmSeverityToLabelPipe, AlarmsModule } from '@c8y/ngx-components/alarms';
import {
  DisplayMode,
  GlobalContextState,
  GLOBAL_CONTEXT_DISPLAY_MODE,
  PRESET_NAME,
  REFRESH_OPTION,
  GlobalContextConnectorComponent,
  LocalControlsComponent
} from '@c8y/ngx-components/global-context';

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

    if (this.chartsComponent?.echartsInstance) {
      this.setupEchartsInterception();
    }

    if (
      datapointsJson !== this.previousDatapointsJson ||
      staticLinesJson !== this.previousStaticLinesJson ||
      areasJson !== this.previousAreasJson
    ) {
      this.previousDatapointsJson = datapointsJson;
      this.previousStaticLinesJson = staticLinesJson;
      this.previousAreasJson = areasJson;
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
      // Small timeout to allow ECharts to finalize series drawing before setOption is called
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
        const markLineData = self.getMarkLineData();
        const markAreaData = self.getMarkAreaData();

        option.series = option.series.map((s: any, idx: number) => {
          if (idx === 0) {
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
      }
      return originalSetOption(option, ...args);
    };

    (echarts.setOption as any).isWrapped = true;
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
          position: 'insideStartTop', // Inside left boundary, on top of the line
          formatter: line.label || '',
          color: '#333',
          fontWeight: 'bold'
        },
        lineStyle: {
          type: 'dashed',
          color: '#333333',
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
              color: area.color || '#ff0000',
              opacity: 0.15 // 15% opacity transparency
            },
            label: {
              show: true,
              position: area.type === 'lower' ? 'insideBottomRight' : 'insideTopRight',
              formatter: area.label || '',
              color: '#333333',
              fontWeight: 'bold',
              fontSize: 11
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
      echarts.setOption(currentOptions);
    }
  }
}
