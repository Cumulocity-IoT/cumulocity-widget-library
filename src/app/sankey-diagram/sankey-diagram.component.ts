/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, ElementRef, inject, input, OnDestroy, OnInit, signal, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlarmService, EventService, InventoryService, MeasurementService } from '@c8y/client';
import { CoreModule, gettext } from '@c8y/ngx-components';
import * as echarts from 'echarts';

interface AssetNode {
  id: string;
  name: string;
  children: AssetNode[];
  directValue: number;
  totalValue: number;
  level: number;
  unit?: string;
}

@Component({
  selector: 'c8y-sankey-diagram',
  template: `
    <div class="sankey-container" [class.is-empty]="loading() || errorMsg() || !hasData()">
      <div class="sankey-actions">
        <button 
          class="btn btn-clean" 
          [title]="'Refresh' | translate" 
          (click)="refreshData()"
          [disabled]="loading()"
        >
          <i c8yIcon="refresh" [ngClass]="{ 'spin': loading() }"></i>
        </button>
      </div>

      @if (loading()) {
        <div class="state-container">
          <div class="spinner-circle"></div>
          <p class="m-t-16 text-muted text-small text-center">{{ 'Loading hierarchy & data...' | translate }}</p>
        </div>
      } @else if (errorMsg()) {
        <div class="state-container">
          <i c8yIcon="exclamation-circle" class="text-danger text-large m-b-8" style="font-size: 36px;"></i>
          <p class="text-muted m-t-8 text-center">{{ errorMsg()! | translate }}</p>
        </div>
      } @else if (!hasData()) {
        <div class="state-container">
          <i c8yIcon="info" class="text-muted text-large m-b-8" style="font-size: 36px;"></i>
          <p class="text-muted m-t-8 text-center">{{ emptyStateText() | translate }}</p>
        </div>
      } @else {
        <!-- The Chart Container -->
        <div 
          #chartContainer 
          class="chart-container" 
        ></div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: flex !important;
      flex-direction: column !important;
      flex: 1 1 100% !important;
      height: 100% !important;
      width: 100% !important;
      min-height: 250px;
    }
    .sankey-container {
      font-family: var(--c8y-font-family-base, inherit);
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      height: 100%;
      width: 100%;
      min-height: 250px;
      padding: 16px;
      box-sizing: border-box;
      position: relative;
      color: var(--c8y-text-color, inherit);
    }
    .sankey-container.is-empty {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .sankey-actions {
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
    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      width: 100%;
      margin: auto;
      padding: 24px;
    }
    .chart-container {
      flex: 1 1 auto;
      width: 100%;
      height: 100%;
      min-height: 250px;
    }
    .spinner-circle {
      display: block;
      width: 36px;
      height: 36px;
      margin: 0 auto;
      border: 3px solid var(--c8y-root-component-border-color, rgba(0,0,0,0.1));
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
export class SankeyDiagramComponent implements OnInit, OnDestroy {
  readonly config = input<any>();

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  title = signal<string>('Sankey Diagram');
  loading = signal<boolean>(false);
  errorMsg = signal<string | null>(null);
  hasData = signal<boolean>(false);
  emptyStateText = signal<string>('No data found in the selected range & hierarchy.');

  private inventoryService = inject(InventoryService);
  private alarmService = inject(AlarmService);
  private eventService = inject(EventService);
  private measurementService = inject(MeasurementService);

  private myChart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private detectedUnit: string = '';

  constructor() {
    effect(() => {
      // Re-trigger load when configuration properties change
      const targetGroupId = this.config()?.device?.id;
      const mode = this.config()?.mode;
      const timeRange = this.config()?.timeRange;
      const searchDepth = this.config()?.searchDepth;
      const typeFilter = this.config()?.typeFilter;
      const fragment = this.config()?.fragment;
      const series = this.config()?.series;
      const measurementAggregation = this.config()?.measurementAggregation;

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
      this.errorMsg.set(gettext('No target group/asset configured.'));
      this.hasData.set(false);
      return;
    }

    const mode = this.config()?.mode || 'alarms';
    if (mode === 'measurements') {
      const fragment = this.config()?.fragment?.trim();
      const series = this.config()?.series?.trim();
      if (!fragment || !series) {
        this.errorMsg.set(gettext('Please configure Measurement Fragment and Series in widget settings.'));
        this.hasData.set(false);
        return;
      }
    }

    this.loading.set(true);
    this.errorMsg.set(null);
    this.destroyChart();
    this.detectedUnit = this.config()?.unit || '';

    try {
      const depth = Number(this.config()?.searchDepth || 1);
      const typeFilter = this.config()?.typeFilter || '';
      const fragment = this.config()?.fragment || '';
      const series = this.config()?.series || '';
      const measurementLabel = this.config()?.measurementLabel || '';
      
      const { from, to } = this.calculateDateRange();

      // Set Title & Empty state message
      if (mode === 'alarms') {
        const typeLabel = typeFilter ? ` [${typeFilter}]` : '';
        this.title.set(`Sankey Flow: Alarms${typeLabel}`);
        this.emptyStateText.set(gettext('No alarms found in the selected range & hierarchy.'));
      } else if (mode === 'events') {
        const typeLabel = typeFilter ? ` [${typeFilter}]` : '';
        this.title.set(`Sankey Flow: Events${typeLabel}`);
        this.emptyStateText.set(gettext('No events found in the selected range & hierarchy.'));
      } else {
        const label = measurementLabel || `${fragment}.${series}`;
        this.title.set(`Sankey Flow: ${label}`);
        this.emptyStateText.set(gettext(`No measurements found for "${fragment}.${series}" in the selected range & hierarchy.`));
      }

      // 1. Fetch hierarchy recursively
      const assetTree = await this.fetchAssetTree(parentId, depth, 0, from, to, mode, this.config());
      
      // 2. Roll up counts / measurement values for all nodes
      this.rollupTreeValues(assetTree);

      if (assetTree.totalValue === 0) {
        this.hasData.set(false);
        this.loading.set(false);
        return;
      }

      this.hasData.set(true);

      // Wait for Angular view rendering
      setTimeout(() => {
        this.initChart(assetTree);
      }, 50);

    } catch (err) {
      console.error('Failed to load Sankey diagram data:', err);
      this.errorMsg.set(gettext('An error occurred while fetching the hierarchy and data.'));
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
    } else if (range === 'lastMonth') {
      from.setMonth(to.getMonth() - 1);
    } else {
      from.setDate(to.getDate() - 7);
    }

    return { from, to };
  }

  private async fetchAssetTree(
    parentId: string,
    maxDepth: number,
    currentDepth: number,
    from: Date,
    to: Date,
    mode: string,
    conf: any
  ): Promise<AssetNode> {
    const response = await this.inventoryService.detail(parentId);
    const mo: any = response.data;
    const name = mo.name || `Unnamed (ID: ${parentId})`;

    // Get direct value for this node itself
    let directValue = 0;
    let unit = conf?.unit || '';

    if (mode === 'measurements') {
      const measResult = await this.fetchMeasurementForAsset(
        parentId,
        from,
        to,
        conf?.fragment,
        conf?.series,
        conf?.measurementAggregation || 'sum'
      );
      directValue = measResult.value;
      if (!unit && measResult.unit) {
        unit = measResult.unit;
        if (!this.detectedUnit) {
          this.detectedUnit = unit;
        }
      }
    } else {
      directValue = await this.fetchAlarmOrEventCounts(parentId, from, to, mode, conf?.typeFilter || '');
    }

    const node: AssetNode = {
      id: parentId,
      name: name,
      children: [],
      directValue,
      totalValue: 0,
      level: currentDepth,
      unit
    };

    if (currentDepth < maxDepth) {
      try {
        // Query child assets, child devices, and child additions to support complete hierarchy
        const [childAssetsRes, childDevicesRes, childAdditionsRes] = await Promise.allSettled([
          this.inventoryService.childAssetsList(parentId, { pageSize: 100 }),
          this.inventoryService.childDevicesList(parentId, { pageSize: 100 }),
          this.inventoryService.childAdditionsList(parentId, { pageSize: 100 })
        ]);

        const childrenList: any[] = [];
        const seenIds = new Set<string>();

        const appendChildren = (result: PromiseSettledResult<any>) => {
          if (result.status === 'fulfilled' && result.value?.data) {
            for (const item of result.value.data) {
              const childMO = item.managedObject || item;
              const childId = childMO?.id ? String(childMO.id) : null;
              if (childId && childId !== parentId && !seenIds.has(childId)) {
                seenIds.add(childId);
                childrenList.push(childMO);
              }
            }
          }
        };

        appendChildren(childAssetsRes);
        appendChildren(childDevicesRes);
        appendChildren(childAdditionsRes);

        if (childrenList.length > 0) {
          const childPromises = childrenList.map((child: any) =>
            this.fetchAssetTree(child.id, maxDepth, currentDepth + 1, from, to, mode, conf)
          );

          node.children = await Promise.all(childPromises);
        }
      } catch (e) {
        console.warn(`Failed to fetch children for ${parentId}:`, e);
      }
    }

    return node;
  }

  private async fetchAlarmOrEventCounts(
    assetId: string,
    from: Date,
    to: Date,
    mode: string,
    typeFilter: string
  ): Promise<number> {
    const filter: any = {
      source: assetId,
      dateFrom: from.toISOString(),
      dateTo: to.toISOString(),
      pageSize: 1,
      withTotalPages: true
    };

    if (typeFilter) {
      filter.type = typeFilter;
    }

    try {
      let response;
      if (mode === 'alarms') {
        response = await this.alarmService.list(filter);
      } else {
        response = await this.eventService.list(filter);
      }
      
      const totalPages = (response.paging as any)?.totalPages || (response.paging as any)?.statistics?.totalPages;
      if (totalPages !== undefined) {
        return totalPages;
      }
      
      const totalCountHeader = response.res.headers.get('x-total-count');
      return totalCountHeader ? Number(totalCountHeader) : response.data.length;
    } catch (err) {
      console.warn(`Failed to fetch ${mode} counts for asset ${assetId}:`, err);
      return 0;
    }
  }

  private async fetchMeasurementForAsset(
    assetId: string,
    from: Date,
    to: Date,
    fragment: string,
    series: string,
    aggregation: string
  ): Promise<{ value: number; unit: string }> {
    try {
      const response = await this.measurementService.list({
        source: assetId,
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        valueFragmentType: fragment,
        valueFragmentSeries: series,
        pageSize: 2000,
        revert: true
      });

      const data = response.data || [];
      if (data.length === 0) {
        return { value: 0, unit: '' };
      }

      let detectedUnit = '';
      const values: number[] = [];

      for (const item of data) {
        const dp = item[fragment]?.[series];
        if (dp && dp.value !== undefined && dp.value !== null && !isNaN(Number(dp.value))) {
          values.push(Number(dp.value));
          if (!detectedUnit && dp.unit) {
            detectedUnit = dp.unit;
          }
        }
      }

      if (values.length === 0) {
        return { value: 0, unit: '' };
      }

      let calculatedValue = 0;
      switch (aggregation) {
        case 'latest':
          // Revert: true means index 0 is latest
          calculatedValue = values[0];
          break;

        case 'delta':
          // Difference between newest and oldest reading in the range
          if (values.length >= 2) {
            const newest = values[0];
            const oldest = values[values.length - 1];
            calculatedValue = Math.max(0, newest - oldest);
          } else {
            calculatedValue = values[0];
          }
          break;

        case 'avg':
          const sumAvg = values.reduce((acc, v) => acc + v, 0);
          calculatedValue = sumAvg / values.length;
          break;

        case 'max':
          calculatedValue = Math.max(...values);
          break;

        case 'min':
          calculatedValue = Math.min(...values);
          break;

        case 'sum':
        default:
          calculatedValue = values.reduce((acc, v) => acc + v, 0);
          break;
      }

      return { value: calculatedValue, unit: detectedUnit };
    } catch (err) {
      console.warn(`Failed to fetch measurements for asset ${assetId}:`, err);
      return { value: 0, unit: '' };
    }
  }

  private rollupTreeValues(node: AssetNode): number {
    let childSum = 0;
    for (const child of node.children) {
      childSum += this.rollupTreeValues(child);
    }
    node.totalValue = Number((node.directValue + childSum).toFixed(4));
    return node.totalValue;
  }

  private formatValue(value: number): string {
    const decimals = this.config()?.decimalPlaces !== undefined ? Number(this.config()?.decimalPlaces) : 2;
    const mode = this.config()?.mode || 'alarms';
    const numDecimals = (mode === 'alarms' || mode === 'events') ? 0 : decimals;
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: numDecimals
    }).format(value);
  }

  private getUnitString(): string {
    const unit = this.config()?.unit || this.detectedUnit || '';
    return unit ? ` ${unit}` : '';
  }

  private buildSankeyData(node: AssetNode): { nodes: any[]; links: any[] } {
    const nodesMap = new Map<string, { label: string; value: number }>();
    const nodeLevelsMap = new Map<string, number>();
    const links: any[] = [];
    const unitStr = this.getUnitString();

    const registerNode = (id: string, label: string, value: number, level: number) => {
      if (!nodesMap.has(id)) {
        nodesMap.set(id, { label, value });
        nodeLevelsMap.set(id, level);
      }
    };

    // DFS to construct links
    const traverse = (current: AssetNode) => {
      registerNode(current.id, current.name, current.totalValue, current.level);

      if (current.directValue > 0 && current.children.length > 0) {
        // Direct Flow Node to balance parent
        const directId = `${current.id}_direct`;
        const directLabel = `${current.name} (Self)`;
        registerNode(directId, directLabel, current.directValue, -1);
        links.push({
          source: current.id,
          target: directId,
          value: current.directValue
        });
      }

      for (const child of current.children) {
        if (child.totalValue > 0) {
          registerNode(child.id, child.name, child.totalValue, child.level);
          links.push({
            source: current.id,
            target: child.id,
            value: child.totalValue
          });
          traverse(child);
        }
      }
    };

    traverse(node);

    // Convert map to nodes array
    const nodes = Array.from(nodesMap.entries()).map(([id, info]) => {
      const level = nodeLevelsMap.get(id) ?? 0;
      let nodeColor = '#1776bf';

      if (level === -1) {
        nodeColor = this.config()?.directColor || '#7E7E80';
      } else {
        const colors = [
          this.config()?.level0Color || '#00A1F2',
          this.config()?.level1Color || '#FF8800',
          this.config()?.level2Color || '#119D11',
          this.config()?.level3Color || '#FFBE00',
          this.config()?.level4Color || '#E51A1A',
          this.config()?.level5Color || '#006699'
        ];
        nodeColor = colors[level] || '#00A1F2';
      }

      const displayFormatted = `${info.label}: ${this.formatValue(info.value)}${unitStr}`;

      return {
        name: id,
        rawName: info.label,
        rawValue: info.value,
        itemStyle: {
          color: nodeColor
        },
        label: {
          show: true,
          formatter: () => displayFormatted
        }
      };
    });

    return { nodes, links };
  }

  private initChart(assetTree: AssetNode) {
    if (!this.chartContainer) return;

    this.destroyChart();

    const { nodes, links } = this.buildSankeyData(assetTree);
    const unitStr = this.getUnitString();
    const mode = this.config()?.mode || 'alarms';

    let modeLabel = 'Alarms';
    if (mode === 'events') modeLabel = 'Events';
    if (mode === 'measurements') modeLabel = this.config()?.measurementLabel || 'Measurement';

    this.myChart = echarts.init(this.chartContainer.nativeElement);

    const option = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const node = nodes.find(n => n.name === params.name);
            const nodeName = node?.rawName || params.name;
            const nodeVal = node?.rawValue !== undefined ? this.formatValue(node.rawValue) : params.value;
            return `<b>Asset:</b> ${nodeName}<br/><b>Total ${modeLabel}:</b> ${nodeVal}${unitStr}`;
          } else {
            const sourceNode = nodes.find(n => n.name === params.data.source);
            const targetNode = nodes.find(n => n.name === params.data.target);
            const sourceName = sourceNode?.rawName || params.data.source;
            const targetName = targetNode?.rawName || params.data.target;
            const flowVal = this.formatValue(params.data.value);
            
            let pctStr = '';
            if (sourceNode && sourceNode.rawValue > 0) {
              const pct = ((params.data.value / sourceNode.rawValue) * 100).toFixed(1);
              pctStr = ` (${pct}%)`;
            }

            return `<b>Flow:</b> ${sourceName} &rarr; ${targetName}<br/><b>${modeLabel}:</b> ${flowVal}${unitStr}${pctStr}`;
          }
        }
      },
      series: [
        {
          type: 'sankey',
          data: nodes,
          links: links,
          emphasis: {
            focus: 'adjacency'
          },
          lineStyle: {
            color: 'gradient',
            curveness: 0.5
          },
          nodeWidth: 20,
          nodeGap: 18,
          layout: 'none',
          label: {
            position: 'right',
            color: 'var(--c8y-text-color, #4c566a)',
            fontSize: 12,
            fontFamily: 'var(--c8y-font-family-base, inherit)'
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: 'var(--c8y-root-component-border-color, #aaa)'
          }
        }
      ]
    };

    this.myChart.setOption(option);

    // Set up ResizeObserver to handle responsiveness
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
