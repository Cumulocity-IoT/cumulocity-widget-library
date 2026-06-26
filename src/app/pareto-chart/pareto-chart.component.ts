/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, ElementRef, inject, input, OnDestroy, OnInit, signal, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlarmService, EventService, InventoryService } from '@c8y/client';
import { CoreModule } from '@c8y/ngx-components';
import * as echarts from 'echarts';

interface TypeCount {
  type: string;
  count: number;
}

@Component({
  selector: 'c8y-pareto-chart',
  template: `
    <div class="pareto-container p-16">
      <div class="pareto-actions">
        <button 
          class="btn btn-clean" 
          title="Refresh" 
          (click)="refreshData()"
          [disabled]="loading()"
        >
          <i c8yIcon="refresh" [ngClass]="{ 'spin': loading() }"></i>
        </button>
      </div>

      @if (loading()) {
        <div class="loading-state text-center p-24">
          <span class="spinner"></span>
          <p class="m-t-8 text-muted text-small">Fetching alarms/events...</p>
        </div>
      } @else if (errorMsg()) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="exclamation-circle" class="text-danger text-large m-b-8"></i>
          <p class="text-muted">{{ errorMsg() }}</p>
        </div>
      } @else if (!hasData()) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="info" class="text-muted text-large m-b-8"></i>
          <p class="text-muted">No alarms/events match the filter criteria in the selected range.</p>
        </div>
      }

      <!-- The Chart Container -->
      <div 
        #chartContainer 
        class="chart-container" 
        [style.display]="(loading() || errorMsg() || !hasData()) ? 'none' : 'block'"
      ></div>
    </div>
  `,
  styles: [`
    .pareto-container {
      font-family: 'Outfit', 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      position: relative;
    }
    .pareto-actions {
      display: flex;
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 10;
    }
    .btn-clean {
      background: transparent;
      border: none;
      box-shadow: none;
      color: var(--c8y-text-color, #3b4252);
      padding: 4px 8px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .btn-clean:hover {
      opacity: 1;
      transform: scale(1.1);
    }
    .spin {
      display: inline-block;
      animation: spin-icon 1s linear infinite;
    }
    @keyframes spin-icon {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .chart-container {
      flex: 1;
      width: 100%;
      min-height: 250px;
    }
    .loading-state, .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
    }
    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 3px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776BF);
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  standalone: true,
  imports: [CommonModule, CoreModule]
})
export class ParetoChartComponent implements OnInit, OnDestroy {
  readonly config = input<any>();

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  loading = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  hasData = signal<boolean>(false);

  private inventoryService = inject(InventoryService);
  private alarmService = inject(AlarmService);
  private eventService = inject(EventService);

  private myChart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    effect(() => {
      // Re-trigger load when configuration properties change
      const targetId = this.config()?.device?.id;
      const mode = this.config()?.mode;
      const timeRange = this.config()?.timeRange;
      const analyseChildren = this.config()?.analyseChildren;
      const groupBy = this.config()?.groupBy;
      const typeFilterMode = this.config()?.typeFilterMode;
      const typesList = this.config()?.typesList;

      this.refreshData();
    });
  }

  ngOnInit() {
    // Handled by effect
  }

  ngOnDestroy() {
    this.destroyChart();
  }

  async refreshData() {
    const parentId = this.config()?.device?.id;
    if (!parentId) {
      this.errorMsg.set('No target asset/group or device configured.');
      this.hasData.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);
    this.destroyChart();

    try {
      const mode = this.config()?.mode || 'alarms';
      const analyseChildren = !!this.config()?.analyseChildren;
      const groupBy = this.config()?.groupBy || 'type';
      const typeFilterMode = this.config()?.typeFilterMode || 'none';
      const typesListRaw = this.config()?.typesList || '';

      const { from, to } = this.calculateDateRange();

      // Resolve sources list & map their IDs to names
      let sources: string[] = [parentId];
      const sourceNamesMap = new Map<string, string>();
      sourceNamesMap.set(parentId, this.config()?.device?.name || parentId);

      if (analyseChildren) {
        try {
          const [childAssets, childDevices] = await Promise.all([
            this.inventoryService.childAssetsList(parentId, { pageSize: 2000 }),
            this.inventoryService.childDevicesList(parentId, { pageSize: 2000 })
          ]);

          const assetItems = (childAssets?.data || [])
            .map((item: any) => item.managedObject || item)
            .filter((c: any) => !!c && c.id);

          const deviceItems = (childDevices?.data || [])
            .map((item: any) => item.managedObject || item)
            .filter((c: any) => !!c && c.id);

          for (const c of assetItems) {
            sourceNamesMap.set(c.id, c.name || c.id);
          }
          for (const c of deviceItems) {
            sourceNamesMap.set(c.id, c.name || c.id);
          }

          const combined = Array.from(new Set([...assetItems.map(c => c.id), ...deviceItems.map(c => c.id)]));
          if (combined.length > 0) {
            sources = combined;
          } else {
            // No children found
            sources = [];
          }
        } catch (e) {
          console.warn('Failed to fetch child assets/devices:', e);
        }
      }

      if (sources.length === 0) {
        this.hasData.set(false);
        this.loading.set(false);
        return;
      }

      // Fetch all alarms/events from the sources in parallel
      const countsMap = new Map<string, number>();
      
      const filterTypesList = typesListRaw
        .split(',')
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0);

      const fetchPromises = sources.map(async (sourceId) => {
        try {
          const filter: any = {
            source: sourceId,
            dateFrom: from.toISOString(),
            dateTo: to.toISOString(),
            pageSize: 2000
          };

          let response;
          if (mode === 'alarms') {
            response = await this.alarmService.list(filter);
          } else {
            response = await this.eventService.list(filter);
          }

          const items = response.data || [];
          for (const item of items) {
            const type = item.type || 'Unknown';
            
            // Check whitelist / blacklist filtering on alarm/event type
            let keep = true;
            if (typeFilterMode === 'whitelist') {
              keep = filterTypesList.includes(type);
            } else if (typeFilterMode === 'blacklist') {
              keep = !filterTypesList.includes(type);
            }

            if (keep) {
              // Group by child name vs type based on configuration
              const key = (groupBy === 'child' && analyseChildren) 
                ? (sourceNamesMap.get(sourceId) || sourceId) 
                : type;
              countsMap.set(key, (countsMap.get(key) || 0) + 1);
            }
          }
        } catch (e) {
          console.warn(`Failed to fetch for source ${sourceId}:`, e);
        }
      });

      await Promise.all(fetchPromises);

      let parsedData: TypeCount[] = [];
      countsMap.forEach((count, key) => {
        parsedData.push({ type: key, count });
      });

      // Sort by count descending
      parsedData.sort((a, b) => b.count - a.count);

      if (parsedData.length === 0) {
        this.hasData.set(false);
        this.loading.set(false);
        return;
      }

      this.hasData.set(true);
      setTimeout(() => {
        this.initChart(parsedData);
      }, 50);

    } catch (err) {
      console.error('Failed to load Pareto Chart data:', err);
      this.errorMsg.set('An error occurred while fetching alarms/events data.');
      this.hasData.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  private calculateDateRange(): { from: Date; to: Date } {
    const to = new Date();
    const from = new Date();
    const range = this.config()?.timeRange || 'lastWeek';

    if (range === 'lastHour') {
      from.setHours(to.getHours() - 1);
    } else if (range === 'lastDay') {
      from.setDate(to.getDate() - 1);
    } else if (range === 'lastWeek') {
      from.setDate(to.getDate() - 7);
    } else {
      from.setDate(to.getDate() - 7);
    }

    return { from, to };
  }

  private initChart(data: TypeCount[]) {
    if (!this.chartContainer) return;

    this.destroyChart();

    const types = data.map(d => d.type);
    const counts = data.map(d => d.count);
    const totalCount = counts.reduce((acc, c) => acc + c, 0);

    let cumulativeSum = 0;
    const cumulativePercentages = counts.map(c => {
      cumulativeSum += c;
      return totalCount > 0 ? Math.round((cumulativeSum / totalCount) * 100) : 0;
    });

    this.myChart = echarts.init(this.chartContainer.nativeElement);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999'
          }
        }
      },
      legend: {
        data: ['Count', 'Cumulative %'],
        bottom: 0
      },
      grid: {
        top: 45,
        left: 15,
        right: 15,
        bottom: 35,
        containLabel: true
      },
      xAxis: [
        {
          type: 'category',
          data: types,
          axisPointer: {
            type: 'shadow'
          },
          axisLabel: {
            interval: 0,
            rotate: types.length > 5 ? 30 : 0,
            overflow: 'truncate',
            width: 100
          }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: 'Count',
          position: 'left',
          axisLabel: {
            formatter: '{value}'
          },
          splitLine: {
            show: true,
            lineStyle: {
              type: 'dashed'
            }
          }
        },
        {
          type: 'value',
          name: 'Percentage',
          min: 0,
          max: 100,
          position: 'right',
          axisLabel: {
            formatter: '{value}%'
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: 'Count',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: '#1776bf',
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 40
        },
        {
          name: 'Cumulative %',
          type: 'line',
          yAxisIndex: 1,
          data: cumulativePercentages,
          itemStyle: {
            color: '#f39c12'
          },
          lineStyle: {
            width: 3
          },
          symbol: 'circle',
          symbolSize: 8
        }
      ]
    };

    this.myChart.setOption(option);

    this.resizeObserver = new ResizeObserver(() => {
      this.myChart?.resize();
    });
    this.resizeObserver.observe(this.chartContainer.nativeElement);
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
}
