/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlarmService } from '@c8y/client';
import { CoreModule } from '@c8y/ngx-components';
import { WidgetConfig, HeatLevel } from './widget-config.model';

interface TimeBucket {
  key: string;
  label: string;
  date: Date;
  endDate: Date;
  count: number;
  color: string;
}

interface HeatmapRow {
  label: string;
  buckets: TimeBucket[];
}

@Component({
  selector: 'c8y-alarm-heatmap',
  template: `
    <div class="heatmap-container p-16">
      <div class="heatmap-actions">
        <button 
          class="btn btn-clean" 
          title="Refresh" 
          (click)="fetchAndAggregateAlarms()"
          [disabled]="loading()"
        >
          <i c8yIcon="refresh" [ngClass]="{ 'spin': loading() }"></i>
        </button>
      </div>

      @if (loading()) {
        <div class="loading-state text-center p-24">
          <span class="spinner"></span>
          <p class="m-t-8 text-muted text-small">Aggregating alarms...</p>
        </div>
      } @else if (rows().length === 0) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="info" class="text-muted text-large"></i>
          <p class="m-t-8 text-muted">No data found in the selected range.</p>
        </div>
      } @else {
        <div class="heatmap-rows">
          <!-- Column Headers perfectly aligned -->
          <div class="heatmap-row-wrapper m-b-8 header-row">
            <div class="row-label"></div>
            <div class="row-cells-container">
              <div class="row-cells" [ngClass]="'cols-' + (config()?.aggregationLevel || 'hourly')">
                @for (header of columnHeaders(); track $index) {
                  <div class="column-header text-center">{{ header }}</div>
                }
              </div>
            </div>
          </div>

          <!-- Heatmap Rows -->
          @for (row of rows(); track row.label) {
            <div class="heatmap-row-wrapper m-b-8">
              <div class="row-label text-small text-muted font-medium">{{ row.label }}</div>
              <div class="row-cells-container">
                <div class="row-cells" [ngClass]="'cols-' + (config()?.aggregationLevel || 'hourly')">
                  @for (bucket of row.buckets; track bucket.key) {
                    <div 
                      class="heatmap-cell"
                      [style.background-color]="bucket.color"
                      [title]="bucket.label + '\nAlarms: ' + bucket.count"
                    >
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <div class="heatmap-legend m-t-24 p-12">
          <div class="legend-title m-b-8 text-small text-muted">Legend (Alarms count):</div>
          <div class="legend-items">
            @for (level of configuredHeatLevels(); track $index) {
              <div class="legend-item">
                <span class="legend-color-box" [style.background-color]="level.color"></span>
                <span class="legend-label text-small">
                  @if (level.max === null) {
                    &ge; {{ level.min }}
                  } @else {
                    {{ level.min }} - {{ level.max }}
                  }
                </span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .heatmap-container {
      font-family: 'Outfit', 'Inter', sans-serif;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
    }

    .heatmap-actions {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8px;
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

    .heatmap-row-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-row {
      margin-bottom: 4px;
    }

    .row-label {
      width: 70px;
      flex-shrink: 0;
      white-space: nowrap;
      text-align: right;
    }

    .row-cells-container {
      flex-grow: 1;
      overflow-x: auto;
      scrollbar-width: none; /* Firefox */
    }

    .row-cells-container::-webkit-scrollbar {
      display: none; /* Chrome/Safari */
    }

    .row-cells {
      display: grid;
      gap: 4px;
      min-width: 0;
    }

    .column-header {
      font-size: 9px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cols-hourly {
      grid-template-columns: repeat(24, 1fr);
    }
    .cols-2h {
      grid-template-columns: repeat(12, 1fr);
    }
    .cols-4h {
      grid-template-columns: repeat(6, 1fr);
    }
    .cols-6h {
      grid-template-columns: repeat(4, 1fr);
    }
    .cols-daily {
      grid-template-columns: repeat(7, 1fr);
    }

    .heatmap-cell {
      aspect-ratio: 1;
      border-radius: 4px;
      cursor: pointer;
      position: relative;
      transition: all 0.15s ease-in-out;
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .heatmap-cell:hover {
      box-shadow: inset 0 0 0 2px rgba(0, 0, 0, 0.2);
      filter: brightness(0.9);
      transform: scale(1.08);
      z-index: 2;
    }

    .heatmap-legend {
      background: rgba(0, 0, 0, 0.02);
      border-top: 1px solid rgba(0, 0, 0, 0.05);
      border-radius: 8px;
    }

    .legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-color-box {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid rgba(0, 0, 0, 0.05);
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
export class AlarmHeatmapComponent implements OnInit {
  readonly config = input<WidgetConfig>();

  title = signal<string>('Alarm Heatmap');
  loading = signal<boolean>(false);
  rows = signal<HeatmapRow[]>([]);

  private alarmService = inject(AlarmService);

  defaultHeatLevels: HeatLevel[] = [
    { min: 0, max: 0, color: '#FFFFFF' },
    { min: 1, max: 2, color: '#FEE2E2' },
    { min: 3, max: 5, color: '#FCA5A5' },
    { min: 6, max: 10, color: '#EF4444' },
    { min: 11, max: null, color: '#991B1B' }
  ];

  deviceInfo = computed(() => this.config()?.device?.name || '');

  configuredHeatLevels = computed(() => {
    return this.config()?.heatLevels || this.defaultHeatLevels;
  });

  columnHeaders = computed(() => {
    const aggregation = this.config()?.aggregationLevel || 'hourly';
    if (aggregation === 'daily') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    }
    if (aggregation === 'hourly') {
      return Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}`);
    }
    if (aggregation === '2h') {
      return Array.from({ length: 12 }, (_, i) => `${(i * 2).toString().padStart(2, '0')}`);
    }
    if (aggregation === '4h') {
      return Array.from({ length: 6 }, (_, i) => `${(i * 4).toString().padStart(2, '0')}`);
    }
    if (aggregation === '6h') {
      return Array.from({ length: 4 }, (_, i) => `${(i * 6).toString().padStart(2, '0')}`);
    }
    return [];
  });

  ngOnInit() {
    this.fetchAndAggregateAlarms();
  }

  async fetchAndAggregateAlarms() {
    const deviceId = this.config()?.device?.id;
    if (!deviceId) {
      this.rows.set([]);
      return;
    }

    this.loading.set(true);
    try {
      const { from, to } = this.calculateDateRange();
      
      // withSourceAssets: true aggregates alarms of the group and all its child assets
      const filter: any = {
        source: deviceId,
        withSourceAssets: true,
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        pageSize: 2000
      };

      const { data } = await this.alarmService.list(filter);
      const generatedBuckets = this.generateTimeBuckets(from, to);

      // Distribute alarms into buckets
      if (data) {
        data.forEach((alarm: any) => {
          if (!alarm.creationTime) return;
          const creationTime = new Date(alarm.creationTime);
          const timeMs = creationTime.getTime();

          const matchingBucket = generatedBuckets.find((b) => {
            return timeMs >= b.date.getTime() && timeMs < b.endDate.getTime();
          });

          if (matchingBucket) {
            matchingBucket.count++;
          }
        });
      }

      // Apply Colors
      generatedBuckets.forEach((b) => {
        b.color = this.getColorForCount(b.count);
      });

      // Chunk buckets into rows
      const heatmapRows: HeatmapRow[] = [];
      const aggregation = this.config()?.aggregationLevel || 'hourly';
      let chunkSize = 7; // daily default

      if (aggregation === 'hourly') chunkSize = 24;
      else if (aggregation === '2h') chunkSize = 12;
      else if (aggregation === '4h') chunkSize = 6;
      else if (aggregation === '6h') chunkSize = 4;

      for (let i = 0; i < generatedBuckets.length; i += chunkSize) {
        const chunk = generatedBuckets.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          let rowLabel = '';
          if (aggregation === 'daily') {
            const startOfWeek = chunk[0].date;
            rowLabel = 'W/C ' + startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          } else {
            const dayOfRow = chunk[0].date;
            rowLabel = dayOfRow.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          }
          heatmapRows.push({
            label: rowLabel,
            buckets: chunk
          });
        }
      }

      this.rows.set(heatmapRows);
    } catch (err) {
      console.error('Error fetching alarms:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private calculateDateRange(): { from: Date; to: Date } {
    const to = new Date();
    let from = new Date();
    const range = this.config()?.timeRange || 'lastWeek';

    if (range === 'last24h') {
      from.setHours(to.getHours() - 24);
    } else if (range === 'lastWeek') {
      from.setDate(to.getDate() - 7);
    } else if (range === 'lastMonth') {
      from.setMonth(to.getMonth() - 1);
    } else if (range === 'custom' && this.config()?.customFrom) {
      from = new Date(this.config()!.customFrom!);
      if (this.config()?.customTo) {
        to.setTime(new Date(this.config()!.customTo!).getTime());
      }
    } else {
      from.setDate(to.getDate() - 7);
    }

    const aggregation = this.config()?.aggregationLevel || 'hourly';
    if (aggregation === 'daily') {
      // Align from to preceding Sunday 00:00:00
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - from.getDay());

      // Align to succeeding Saturday 23:59:59
      to.setHours(23, 59, 59, 999);
      to.setDate(to.getDate() + (6 - to.getDay()));
    } else {
      // Align from to start of day 00:00:00
      from.setHours(0, 0, 0, 0);
      // Align to end of day 23:59:59
      to.setHours(23, 59, 59, 999);
    }

    return { from, to };
  }

  private generateTimeBuckets(from: Date, to: Date): TimeBucket[] {
    const list: TimeBucket[] = [];
    const current = new Date(from);
    const aggregation = this.config()?.aggregationLevel || 'hourly';

    let stepMs = 0;
    if (aggregation === 'hourly') {
      stepMs = 60 * 60 * 1000;
    } else if (aggregation === '2h') {
      stepMs = 2 * 60 * 60 * 1000;
    } else if (aggregation === '4h') {
      stepMs = 4 * 60 * 60 * 1000;
    } else if (aggregation === '6h') {
      stepMs = 6 * 60 * 60 * 1000;
    } else if (aggregation === 'daily') {
      stepMs = 24 * 60 * 60 * 1000;
    } else {
      stepMs = 60 * 60 * 1000;
    }

    while (current.getTime() < to.getTime()) {
      const dateCopy = new Date(current);
      const endDate = new Date(current.getTime() + stepMs);
      
      const key = dateCopy.toISOString();
      let label = '';
      
      if (aggregation === 'daily') {
        label = dateCopy.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } else {
        const startStr = dateCopy.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const endStr = endDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        label = `${dateCopy.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${startStr} - ${endStr}`;
      }

      list.push({
        key,
        label,
        date: dateCopy,
        endDate,
        count: 0,
        color: '#FFFFFF'
      });

      current.setTime(current.getTime() + stepMs);
    }
    return list;
  }

  private getColorForCount(count: number): string {
    const levels = this.configuredHeatLevels();
    const matched = levels.find((l) => {
      if (l.max === null) {
        return count >= l.min;
      }
      return count >= l.min && count <= l.max;
    });
    return matched ? matched.color : '#FFFFFF';
  }
}

