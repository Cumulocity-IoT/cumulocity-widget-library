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

interface AssetNode {
  id: string;
  name: string;
  children: AssetNode[];
  directCount: number;
  totalCount: number;
  level: number;
}

@Component({
  selector: 'c8y-sankey-diagram',
  template: `
    <div class="sankey-container p-16">
      <div class="sankey-actions">
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
          <p class="m-t-8 text-muted text-small">Loading hierarchy & counts...</p>
        </div>
      } @else if (errorMsg()) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="exclamation-circle" class="text-danger text-large m-b-8"></i>
          <p class="text-muted">{{ errorMsg() }}</p>
        </div>
      } @else if (!hasData()) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="info" class="text-muted text-large m-b-8"></i>
          <p class="text-muted">No events/alarms found in the selected range & hierarchy.</p>
        </div>
      }

      <!-- The Chart Container. It is always present but hidden when empty/loading to preserve DOM ref -->
      <div 
        #chartContainer 
        class="chart-container" 
        [style.display]="(loading() || errorMsg() || !hasData()) ? 'none' : 'block'"
      ></div>
    </div>
  `,
  styles: [`
    .sankey-container {
      font-family: 'Outfit', 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
      position: relative;
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
export class SankeyDiagramComponent implements OnInit, OnDestroy {
  readonly config = input<any>();

  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;

  title = signal<string>('Sankey Diagram');
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
      const targetGroupId = this.config()?.device?.id;
      const mode = this.config()?.mode;
      const timeRange = this.config()?.timeRange;
      const searchDepth = this.config()?.searchDepth;
      const typeFilter = this.config()?.typeFilter;

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
      this.errorMsg.set('No target group/asset configured.');
      this.hasData.set(false);
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);
    this.destroyChart();

    try {
      const mode = this.config()?.mode || 'alarms';
      const depth = Number(this.config()?.searchDepth || 1);
      const typeFilter = this.config()?.typeFilter || '';
      
      const { from, to } = this.calculateDateRange();

      // Set Title
      const modeLabel = mode === 'alarms' ? 'Alarms' : 'Events';
      const typeLabel = typeFilter ? ` [${typeFilter}]` : '';
      this.title.set(`Sankey Flow: ${modeLabel}${typeLabel}`);

      // 1. Fetch hierarchy recursively
      const assetTree = await this.fetchAssetTree(parentId, depth, 0, from, to, mode, typeFilter);
      
      // 2. Roll up counts to compute totalCount for all nodes
      this.rollupTreeCounts(assetTree);

      if (assetTree.totalCount === 0) {
        this.hasData.set(false);
        this.loading.set(false);
        return;
      }

      this.hasData.set(true);

      // We need to wait for Angular to update display style on chartContainer ref
      setTimeout(() => {
        this.initChart(assetTree);
      }, 50);

    } catch (err) {
      console.error('Failed to load Sankey diagram data:', err);
      this.errorMsg.set('An error occurred while fetching the hierarchy and counts.');
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
    typeFilter: string
  ): Promise<AssetNode> {
    const response = await this.inventoryService.detail(parentId);
    const mo: any = response.data;
    const name = mo.name || `Unnamed (ID: ${parentId})`;

    // Get count for this asset itself
    const directCount = await this.fetchCountsForAsset(parentId, from, to, mode, typeFilter);

    const node: AssetNode = {
      id: parentId,
      name: name,
      children: [],
      directCount,
      totalCount: 0,
      level: currentDepth
    };

    if (currentDepth < maxDepth) {
      try {
        const childResponse = await this.inventoryService.childAssetsList(parentId, { pageSize: 100 });
        if (childResponse && childResponse.data && childResponse.data.length > 0) {
          const childMOs = childResponse.data
            .map((item: any) => item.managedObject || item)
            .filter((child: any) => !!child && child.id);

          const childPromises = childMOs.map((child: any) =>
            this.fetchAssetTree(child.id, maxDepth, currentDepth + 1, from, to, mode, typeFilter)
          );

          node.children = await Promise.all(childPromises);
        }
      } catch (e) {
        console.warn(`Failed to fetch child assets for ${parentId}:`, e);
      }
    }

    return node;
  }

  private async fetchCountsForAsset(
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
      
      // Since pageSize is 1, totalPages is exactly the total count of matches
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

  private rollupTreeCounts(node: AssetNode): number {
    let childSum = 0;
    for (const child of node.children) {
      childSum += this.rollupTreeCounts(child);
    }
    node.totalCount = node.directCount + childSum;
    return node.totalCount;
  }

  private buildSankeyData(node: AssetNode): { nodes: any[]; links: any[] } {
    const nodesMap = new Map<string, string>();
    const nodeLevelsMap = new Map<string, number>();
    const links: any[] = [];

    // Helper to register node names and avoid collisions
    const registerNode = (id: string, label: string, level: number) => {
      if (!nodesMap.has(id)) {
        nodesMap.set(id, label);
        nodeLevelsMap.set(id, level);
      }
    };

    // DFS to construct links
    const traverse = (current: AssetNode) => {
      registerNode(current.id, current.name, current.level);

      if (current.directCount > 0 && current.children.length > 0) {
        // Direct Flow Node to balance parent
        const directId = `${current.id}_direct`;
        registerNode(directId, 'Direct', -1);
        links.push({
          source: current.id,
          target: directId,
          value: current.directCount
        });
      }

      for (const child of current.children) {
        if (child.totalCount > 0) {
          registerNode(child.id, child.name, child.level);
          links.push({
            source: current.id,
            target: child.id,
            value: child.totalCount
          });
          traverse(child);
        }
      }
    };

    traverse(node);

    // Convert map to nodes array
    const nodes = Array.from(nodesMap.entries()).map(([id, label]) => {
      const level = nodeLevelsMap.get(id) ?? 0;
      let nodeColor = '#1776bf';

      if (level === -1) {
        nodeColor = this.config()?.directColor || '#7f8c8d';
      } else {
        const colors = [
          this.config()?.level0Color || '#1776bf',
          this.config()?.level1Color || '#f39c12',
          this.config()?.level2Color || '#2ecc71',
          this.config()?.level3Color || '#9b59b6',
          this.config()?.level4Color || '#e74c3c',
          this.config()?.level5Color || '#1abc9c'
        ];
        nodeColor = colors[level] || '#1776bf';
      }

      return {
        name: id,
        itemStyle: {
          color: nodeColor
        },
        label: {
          show: true,
          formatter: () => label
        }
      };
    });

    return { nodes, links };
  }

  private initChart(assetTree: AssetNode) {
    if (!this.chartContainer) return;

    this.destroyChart();

    const { nodes, links } = this.buildSankeyData(assetTree);

    this.myChart = echarts.init(this.chartContainer.nativeElement);

    const option = {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove',
        formatter: (params: any) => {
          const modeLabel = this.config()?.mode === 'alarms' ? 'Alarms' : 'Events';
          if (params.dataType === 'node') {
            const nodeName = params.data.label?.formatter() || params.name;
            return `<b>Asset:</b> ${nodeName}<br/><b>Total ${modeLabel}:</b> ${params.value}`;
          } else {
            const sourceName = nodes.find(n => n.name === params.data.source)?.label?.formatter() || params.data.source;
            const targetName = nodes.find(n => n.name === params.data.target)?.label?.formatter() || params.data.target;
            return `<b>Flow:</b> ${sourceName} &rarr; ${targetName}<br/><b>${modeLabel}:</b> ${params.data.value}`;
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
            color: '#4c566a',
            fontSize: 12
          },
          itemStyle: {
            borderWidth: 1,
            borderColor: '#aaa'
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
