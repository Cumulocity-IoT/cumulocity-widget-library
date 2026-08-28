/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IManagedObject, InventoryService } from '@c8y/client';
import { CoreModule, gettext } from '@c8y/ngx-components';
import * as echarts from 'echarts';
import {
  buildInventoryQuery,
  extractPropertyValue,
  FleetStatisticsConfig,
  generateBrandDerivedPalette,
  getThemeBrandShades,
  GroupedCategory
} from './fleet-statistics.model';

@Component({
  selector: 'c8y-fleet-statistics',
  template: `
    <div class="fleet-stats-container p-16">
      <!-- Top Action Bar -->
      <div class="fleet-stats-header">
        <div class="fleet-stats-badges">
          @if (hasData() && !loading() && !errorMsg()) {
            <span class="badge badge-info" [title]="'Total matching items' | translate">
              <i c8yIcon="c8y-device" class="m-r-4"></i>
              {{ totalCount() }} {{ (config()?.targetScope === 'assets' ? 'assets' : 'devices') | translate }}
            </span>
            <span class="badge badge-default" [title]="'Distinct groups' | translate">
              {{ distinctGroupsCount() }} {{ 'groups' | translate }}
            </span>
          }
        </div>
        <div class="fleet-stats-actions">
          <button 
            type="button"
            class="btn btn-clean" 
            [title]="'Refresh statistics' | translate" 
            (click)="loadStatistics()"
            [disabled]="loading()"
          >
            <i c8yIcon="refresh" [ngClass]="{ 'spin': loading() }"></i>
          </button>
        </div>
      </div>

      <!-- State: Loading -->
      @if (loading()) {
        <div class="loading-state text-center p-24">
          <span class="spinner"></span>
          <p class="m-t-8 text-muted text-small">{{ 'Querying inventory statistics...' | translate }}</p>
        </div>
      } 
      <!-- State: Error -->
      @else if (errorMsg()) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="exclamation-circle" class="text-danger text-large m-b-8"></i>
          <p class="text-danger font-bold">{{ 'Failed to load statistics' | translate }}</p>
          <p class="text-muted text-small">{{ errorMsg() }}</p>
        </div>
      } 
      <!-- State: Empty / No Data -->
      @else if (!hasData()) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="pie-chart" class="text-muted text-large m-b-8"></i>
          <p class="text-muted font-bold">{{ 'No inventory data found' | translate }}</p>
          <p class="text-muted text-small">{{ 'No devices or assets matched the configured OData query criteria.' | translate }}</p>
        </div>
      }

      <!-- Main Chart Container -->
      <div 
        #chartContainer 
        class="chart-container" 
        [style.display]="(loading() || errorMsg() || !hasData()) ? 'none' : 'block'"
      ></div>

      <!-- Drilldown Details Modal / Slide-in Panel -->
      @if (selectedCategory()) {
        <div class="drilldown-panel p-16">
          <div class="drilldown-header">
            <div>
              <span class="category-name font-bold">{{ selectedCategory()?.name }}</span>
              <span class="badge badge-primary m-l-8">{{ selectedCategory()?.value }} ({{ selectedCategory()?.percentage }}%)</span>
            </div>
            <button type="button" class="btn btn-clean" (click)="selectedCategory.set(null)" [title]="'Close list' | translate">
              <i c8yIcon="times"></i>
            </button>
          </div>

          <div class="drilldown-list-wrapper m-t-8">
            <table class="table table-condensed table-striped table-hover">
              <thead>
                <tr>
                  <th translate>Name</th>
                  <th translate>ID</th>
                  <th translate>Type</th>
                </tr>
              </thead>
              <tbody>
                @for (obj of selectedCategory()?.matchingObjects?.slice(0, 100); track obj.id) {
                  <tr>
                    <td class="text-truncate" style="max-width: 160px;" [title]="obj['name'] || obj.id">
                      <strong>{{ obj['name'] || obj.id }}</strong>
                    </td>
                    <td><code>{{ obj.id }}</code></td>
                    <td class="text-muted text-small">{{ obj['type'] || '-' }}</td>
                  </tr>
                }
              </tbody>
            </table>
            @if ((selectedCategory()?.matchingObjects?.length || 0) > 100) {
              <p class="text-muted text-center text-small p-8">
                {{ 'Showing first 100 of' | translate }} {{ selectedCategory()?.matchingObjects?.length }} {{ 'items' | translate }}
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .fleet-stats-container {
      font-family: var(--c8y-font-family-base, inherit);
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      position: relative;
      color: var(--c8y-text-color, inherit);
      overflow: hidden;
    }
    .fleet-stats-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      z-index: 5;
    }
    .fleet-stats-badges {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .fleet-stats-actions {
      display: flex;
      align-items: center;
    }
    .btn-clean {
      background: transparent;
      border: none;
      box-shadow: none;
      color: var(--c8y-text-color, #3b4252);
      padding: 4px 6px;
      cursor: pointer;
      opacity: 0.65;
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
      min-height: 220px;
    }
    .loading-state, .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      background: var(--c8y-card-background-default, rgba(128, 128, 128, 0.05));
      border: 1px dashed var(--c8y-root-component-border-color, rgba(128, 128, 128, 0.2));
      border-radius: 8px;
    }
    .spinner {
      display: inline-block;
      width: 26px;
      height: 26px;
      border: 3px solid var(--c8y-root-component-border-color, rgba(0,0,0,0.1));
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776BF);
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .drilldown-panel {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 55%;
      background: var(--c8y-card-background-default, #ffffff);
      border-top: 2px solid var(--c8y-brand-primary, #1776bf);
      box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
      z-index: 20;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.2s ease-out;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .drilldown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .drilldown-list-wrapper {
      flex: 1;
      overflow-y: auto;
      border: 1px solid var(--c8y-root-component-border-color, #e2e8f0);
      border-radius: 4px;
    }
  `],
  standalone: true,
  imports: [CommonModule, CoreModule]
})
export class FleetStatisticsComponent implements OnInit, OnDestroy {
  readonly config = input<FleetStatisticsConfig>();

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  loading = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  hasData = signal<boolean>(false);
  totalCount = signal<number>(0);
  distinctGroupsCount = signal<number>(0);

  selectedCategory = signal<GroupedCategory | null>(null);

  private inventoryService = inject(InventoryService);
  private myChart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private categoriesMap: Map<string, GroupedCategory> = new Map();

  constructor() {
    effect(() => {
      // Re-trigger load when configuration changes
      const conf = this.config();
      if (conf) {
        this.loadStatistics();
      }
    });
  }

  ngOnInit() {
    // Handled by effect
  }

  ngOnDestroy() {
    this.destroyChart();
  }

  async loadStatistics() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.selectedCategory.set(null);
    this.destroyChart();

    try {
      const conf = this.config() || {};
      const targetScope = conf.targetScope || 'devices';
      const customFilter = conf.queryFilter || '';
      const groupByProp = conf.groupByProperty || (targetScope === 'assets' ? 'type' : 'c8y_Firmware.version');
      const dateExtractionMode = conf.dateExtractionMode || 'none';
      const fallbackLabel = conf.fallbackLabel || gettext('Unknown');
      const maxSlices = conf.maxSlices || 10;
      const showOther = conf.showOtherGroup !== false;

      const query = buildInventoryQuery(targetScope, customFilter);

      const filter: any = {
        pageSize: 2000,
        withTotalPages: true
      };

      if (query) {
        filter.query = query;
      }

      // Fetch managedObjects
      const response = await this.inventoryService.list(filter);
      const items: IManagedObject[] = response.data || [];

      if (items.length === 0) {
        this.hasData.set(false);
        this.totalCount.set(0);
        this.distinctGroupsCount.set(0);
        this.loading.set(false);
        return;
      }

      this.totalCount.set(items.length);

      // Aggregate and group items by property value
      const groupMap = new Map<string, GroupedCategory>();

      for (const mo of items) {
        const extracted = extractPropertyValue(mo, groupByProp, dateExtractionMode, fallbackLabel);

        const values = Array.isArray(extracted) ? extracted : [extracted];

        for (const val of values) {
          const key = String(val || fallbackLabel);
          const existing = groupMap.get(key);
          if (existing) {
            existing.value += 1;
            existing.matchingObjects.push(mo);
          } else {
            groupMap.set(key, {
              name: key,
              value: 1,
              matchingObjects: [mo]
            });
          }
        }
      }

      this.distinctGroupsCount.set(groupMap.size);

      // Convert to array and sort descending by count
      let sortedCategories: GroupedCategory[] = Array.from(groupMap.values()).sort(
        (a, b) => b.value - a.value
      );

      // Calculate percentages
      const grandTotal = sortedCategories.reduce((acc, c) => acc + c.value, 0);
      for (const cat of sortedCategories) {
        cat.percentage = grandTotal > 0 ? Math.round((cat.value / grandTotal) * 1000) / 10 : 0;
      }

      // Handle slice limiting and "Other" grouping
      let displayCategories: GroupedCategory[] = [];
      if (sortedCategories.length > maxSlices && showOther) {
        const topSlices = sortedCategories.slice(0, maxSlices);
        const otherSlices = sortedCategories.slice(maxSlices);

        const otherCount = otherSlices.reduce((acc, c) => acc + c.value, 0);
        const otherPercentage = grandTotal > 0 ? Math.round((otherCount / grandTotal) * 1000) / 10 : 0;
        const otherObjects = otherSlices.flatMap(c => c.matchingObjects);

        displayCategories = [
          ...topSlices,
          {
            name: gettext('Other'),
            value: otherCount,
            percentage: otherPercentage,
            matchingObjects: otherObjects
          }
        ];
      } else {
        displayCategories = sortedCategories;
      }

      // Store in map for click drilldown
      this.categoriesMap.clear();
      for (const c of sortedCategories) {
        this.categoriesMap.set(c.name, c);
      }
      if (showOther && sortedCategories.length > maxSlices) {
        this.categoriesMap.set(gettext('Other'), displayCategories[displayCategories.length - 1]);
      }

      this.hasData.set(true);

      setTimeout(() => {
        this.initChart(displayCategories, grandTotal);
      }, 50);

    } catch (err: any) {
      console.error('Failed to load Fleet Statistics data:', err);
      const detail = err?.data?.message || err?.message || gettext('Please check your OData filter query and permissions.');
      this.errorMsg.set(detail);
      this.hasData.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  private initChart(categories: GroupedCategory[], grandTotal: number) {
    if (!this.chartContainer?.nativeElement) return;

    this.destroyChart();

    const conf = this.config() || {};
    const chartStyle = conf.chartStyle || 'donut';
    const isDonut = chartStyle === 'donut';
    const valueDisplay = conf.valueDisplay || 'both';
    const legendPosition = conf.legendPosition || 'bottom';

    this.myChart = echarts.init(this.chartContainer.nativeElement);

    const colors = this.resolveChartColors(categories);

    const chartData = categories.map((c, idx) => ({
      name: c.name,
      value: c.value,
      itemStyle: {
        color: colors[idx % colors.length]
      }
    }));

    const option: echarts.EChartsOption = {
      color: colors,
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const val = params.value;
          const percent = params.percent;
          return `
            <div style="font-weight: 600; margin-bottom: 2px;">${params.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span>${gettext('Count')}:</span>
              <strong>${val}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <span>${gettext('Share')}:</span>
              <strong>${percent}%</strong>
            </div>
          `;
        }
      },
      legend: legendPosition === 'none' ? { show: false } : {
        show: true,
        type: 'scroll',
        orient: legendPosition === 'right' ? 'vertical' : 'horizontal',
        left: legendPosition === 'right' ? 'right' : 'center',
        top: legendPosition === 'top' ? 'top' : (legendPosition === 'right' ? 'middle' : 'bottom'),
        textStyle: {
          color: 'var(--c8y-text-muted, #64748b)',
          fontFamily: 'var(--c8y-font-family-base, inherit)',
          fontSize: 11
        }
      },
      series: [
        {
          name: gettext('Fleet Distribution'),
          type: 'pie',
          radius: isDonut ? ['48%', '75%'] : [0, '75%'],
          center: legendPosition === 'right' ? ['40%', '50%'] : ['50%', '48%'],
          avoidLabelOverlap: true,
          minAngle: 4,
          padAngle: 1.5,
          itemStyle: {
            borderRadius: isDonut ? 4 : 2,
            borderColor: 'var(--c8y-card-background-default, #ffffff)',
            borderWidth: 2
          },
          labelLine: {
            show: true,
            smooth: 0.2,
            length: 12,
            length2: 14,
            lineStyle: {
              color: 'rgba(128, 128, 128, 0.45)',
              width: 1
            }
          },
          label: {
            show: true,
            position: 'outside',
            formatter: (params: any) => {
              if (valueDisplay === 'count') return `${params.name}: ${params.value}`;
              if (valueDisplay === 'percentage') return `${params.name}: ${params.percent}%`;
              return `${params.name}\n${params.value} (${params.percent}%)`;
            },
            fontSize: 11,
            color: 'var(--c8y-text-color, #334155)',
            fontFamily: 'var(--c8y-font-family-base, inherit)'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 12,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 8,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.25)'
            }
          },
          data: chartData
        }
      ]
    };

    this.myChart.setOption(option);

    // On slice click: open drilldown list
    this.myChart.on('click', (params: any) => {
      const category = this.categoriesMap.get(params.name);
      if (category) {
        this.selectedCategory.set(category);
      }
    });

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

  private resolveChartColors(categories: GroupedCategory[]): string[] {
    const conf = this.config() || {};

    if (conf.colorMode === 'custom' && conf.customColors && conf.customColors.length > 0) {
      return categories.map((cat, idx) => {
        if (cat.name === gettext('Other') || cat.name === 'Other') {
          return '#94a3b8';
        }
        return conf.customColors![idx % conf.customColors!.length];
      });
    }

    // 1. First, check for official theme brand shades (--c8y-brand-10..80) from branding
    const themeShades = getThemeBrandShades();
    if (themeShades.length >= 4) {
      return categories.map((cat, idx) => {
        if (cat.name === gettext('Other') || cat.name === 'Other') {
          return '#94a3b8';
        }
        return themeShades[idx % themeShades.length];
      });
    }

    // 2. Fallback: Determine current brand primary color from document / CSS variables
    let brandPrimary = '#1776bf';
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const rootStyle = getComputedStyle(document.documentElement);
      const cssBrand = rootStyle.getPropertyValue('--c8y-brand-primary')?.trim();
      if (cssBrand && (cssBrand.startsWith('#') || cssBrand.startsWith('rgb') || cssBrand.startsWith('hsl'))) {
        brandPrimary = cssBrand;
      }
    }

    const generated = generateBrandDerivedPalette(brandPrimary, Math.max(12, categories.length));

    return categories.map((cat, idx) => {
      if (cat.name === gettext('Other') || cat.name === 'Other') {
        return '#94a3b8';
      }
      return generated[idx % generated.length];
    });
  }
}

