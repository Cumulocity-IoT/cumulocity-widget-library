/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MeasurementService } from '@c8y/client';
import { MeasurementRealtimeService } from '@c8y/ngx-components';
import { Subscription } from 'rxjs';

interface ActiveMetric {
  label: string;
  fragment: string;
  series: string;
  min: number;
  max: number;
  target: number;
  unit?: string;
  currentVal: number | null;
  score: number | null;
}

@Component({
  selector: 'lib-ideal-state-deviation-widget',
  standalone: false,
  providers: [DecimalPipe, MeasurementRealtimeService],
  template: `
    <div class="deviation-widget-container">
      @if (isLoading) {
        <div class="state-container text-center p-24">
          <span class="spinner"></span>
          <p class="m-t-8 text-muted text-small">Loading metrics configuration...</p>
        </div>
      } @else if (!config?.device?.id) {
        <div class="state-container text-center p-24">
          <i c8yIcon="hdd-o" class="text-muted text-large m-b-8"></i>
          <p class="text-muted">No device selected. Please edit the widget settings.</p>
        </div>
      } @else if (!config?.datapoints || config.datapoints.length === 0) {
        <div class="state-container text-center p-24">
          <i c8yIcon="sliders" class="text-muted text-large m-b-8"></i>
          <p class="text-muted">No data points selected. Please edit the widget settings.</p>
        </div>
      } @else {
        <div class="widget-content">
          <!-- Main Radial Score Indicator (Left side, takes 50% width) -->
          <div class="score-display-wrapper">
            <div class="score-ring-container">
              <svg viewBox="0 0 120 120" class="radial-svg">
                <!-- Background Ring -->
                <circle 
                  cx="60" 
                  cy="60" 
                  r="50" 
                  class="ring-bg"
                />
                <!-- Foreground Progress Arc -->
                <circle 
                  cx="60" 
                  cy="60" 
                  r="50" 
                  class="ring-progress"
                  [attr.stroke]="getScoreColor(totalScore)"
                  [attr.stroke-dasharray]="314.16"
                  [attr.stroke-dashoffset]="getStrokeDashoffset()"
                />
                <!-- SVG Center Text to make it scale automatically -->
                <text 
                  x="60" 
                  y="65" 
                  text-anchor="middle" 
                  class="score-value-svg"
                  [attr.fill]="getScoreColor(totalScore)"
                >
                  {{ totalScore !== null ? (totalScore | number:'1.0-0') : '--' }}
                </text>
                <text 
                  x="60" 
                  y="82" 
                  text-anchor="middle" 
                  class="score-label-svg"
                >
                  SCORE
                </text>
              </svg>
            </div>
          </div>

          <!-- Individual Metrics List (Right side, takes 50% width) -->
          @if (config.showDetailedList !== false) {
            <div class="metrics-list">
              <h5 class="section-title">Individual Scores</h5>
              <div class="metrics-grid">
                @for (m of metrics; track m.fragment + '.' + m.series) {
                  <div class="metric-row">
                    <div class="metric-info">
                      <span class="metric-label" [title]="m.label">{{ m.label }}</span>
                      <span class="metric-value-row">
                        Current: <strong>{{ m.currentVal !== null ? (m.currentVal | number:'1.1-2') : 'N/A' }}{{ m.unit ? ' ' + m.unit : '' }}</strong>
                      </span>
                      <span class="metric-value-row text-muted">
                        Ideal: {{ m.target }}{{ m.unit ? ' ' + m.unit : '' }}
                      </span>
                    </div>
                    <div class="metric-status">
                      <div class="metric-progress-bar-bg">
                        <div 
                          class="metric-progress-bar-fill"
                          [style.width]="(m.score || 0) + '%'"
                          [style.background-color]="getScoreColor(m.score)"
                        ></div>
                      </div>
                      <span class="metric-score" [style.color]="getScoreColor(m.score)">
                        {{ m.score !== null ? (m.score | number:'1.0-0') + '%' : 'N/A' }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .deviation-widget-container {
      font-family: 'Outfit', 'Inter', sans-serif;
      height: 100%;
      width: 100%;
      box-sizing: border-box;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      padding: 16px;
    }
    .state-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }
    .widget-content {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      width: 100%;
      gap: 32px;
      height: 100%;
    }
    .score-display-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      flex: 1;
    }
    .widget-content:has(.metrics-list) .score-display-wrapper {
      flex: 0 0 calc(50% - 16px);
      width: calc(50% - 16px);
    }
    .score-ring-container {
      position: relative;
      width: 100%;
      max-width: 200px;
      aspect-ratio: 1 / 1;
    }
    .widget-content:not(:has(.metrics-list)) .score-ring-container {
      max-width: 380px;
      width: 85%;
    }
    .radial-svg {
      width: 100%;
      height: 100%;
    }
    .ring-bg {
      fill: none;
      stroke: #f1f5f9;
      stroke-width: 8;
    }
    .ring-progress {
      fill: none;
      stroke-width: 8;
      stroke-linecap: round;
      transform: rotate(-90deg);
      transform-origin: center;
      transition: stroke-dashoffset 0.8s cubic-bezier(0.25, 0.8, 0.25, 1),
                  stroke 0.4s ease;
    }
    .score-value-svg {
      font-size: 28px;
      font-weight: 800;
      font-family: 'Outfit', 'Inter', sans-serif;
      transition: fill 0.4s ease;
    }
    .score-label-svg {
      font-size: 6px;
      font-weight: 700;
      fill: #94a3b8;
      letter-spacing: 0.1em;
    }
    .metrics-list {
      flex: 0 0 calc(50% - 16px);
      width: calc(50% - 16px);
      min-width: 250px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      margin-top: 0;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
    }
    .metrics-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      gap: 12px;
    }
    .metric-info {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .metric-label {
      font-size: 12px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .metric-value-row {
      font-size: 10px;
      color: #475569;
      margin-top: 1px;
    }
    .metric-status {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 130px;
      flex-shrink: 0;
    }
    .metric-progress-bar-bg {
      height: 5px;
      background: #e2e8f0;
      border-radius: 3px;
      flex: 1;
      overflow: hidden;
    }
    .metric-progress-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.6s cubic-bezier(0.25, 0.8, 0.25, 1),
                  background-color 0.4s ease;
    }
    .metric-score {
      font-size: 11px;
      font-weight: 700;
      width: 32px;
      text-align: right;
    }
    .spinner {
      display: inline-block;
      width: 28px;
      height: 28px;
      border: 3px solid rgba(0,0,0,0.08);
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776BF);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class IdealStateDeviationWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @Input() config: any;

  private measurementService = inject(MeasurementService);
  private measurementRealtime = inject(MeasurementRealtimeService);
  private changeRef = inject(ChangeDetectorRef);

  isLoading = false;
  metrics: ActiveMetric[] = [];
  latestValues: { [key: string]: number | null } = {};
  totalScore: number | null = null;

  private realtimeSubscription?: Subscription;
  private currentSubscribedDeviceId?: string;

  ngOnInit() {
    this.initializeWidget();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['config'] && !changes['config'].firstChange) {
      this.initializeWidget();
    }
  }

  ngOnDestroy() {
    this.unsubscribeRealtime();
  }

  async initializeWidget() {
    if (!this.config?.device?.id || !this.config?.datapoints || this.config.datapoints.length === 0) {
      this.totalScore = null;
      this.metrics = [];
      this.unsubscribeRealtime();
      return;
    }

    this.isLoading = true;
    this.changeRef.detectChanges();

    try {
      // 1. Populate metrics from Native Datapoints selector config
      this.metrics = (this.config.datapoints || []).map((dp: any) => ({
        label: dp.label || dp.series,
        fragment: dp.fragment,
        series: dp.series,
        min: dp.min !== undefined && dp.min !== null ? Number(dp.min) : 0,
        max: dp.max !== undefined && dp.max !== null ? Number(dp.max) : 100,
        target: dp.target !== undefined && dp.target !== null ? Number(dp.target) : 50,
        unit: dp.unit || '',
        currentVal: null,
        score: null
      }));

      // 2. Fetch latest measurement values
      await this.fetchLatestData();

      // 3. Setup realtime listener
      this.setupRealtime();

    } catch (e) {
      console.error('Failed to initialize deviation widget:', e);
      this.totalScore = null;
      this.metrics = [];
    } finally {
      this.isLoading = false;
      this.changeRef.detectChanges();
    }
  }

  getMetricKey(m: { fragment: string; series: string }): string {
    return `${m.fragment}__${m.series}`;
  }

  async fetchLatestData() {
    if (this.metrics.length === 0) return;

    try {
      const { data: measurements } = await this.measurementService.list({
        source: this.config.device.id,
        pageSize: 100,
        revert: true
      });

      this.metrics.forEach(metric => {
        const key = this.getMetricKey(metric);
        // Find latest measurement containing this fragment and series
        const latestMeas = measurements.find(
          (m: any) => m[metric.fragment]?.[metric.series]?.value !== undefined && m[metric.fragment]?.[metric.series]?.value !== null
        );

        if (latestMeas) {
          this.latestValues[key] = Number(latestMeas[metric.fragment][metric.series].value);
        } else {
          this.latestValues[key] = null;
        }
      });

      this.calculateScore();
    } catch (e) {
      console.error('Failed to fetch latest measurements:', e);
    }
  }

  calculateScore() {
    if (this.metrics.length === 0) {
      this.totalScore = null;
      return;
    }

    let sum = 0;
    let validCount = 0;

    const mode = this.config.calculationMode || 'linear';
    const gracePct = (this.config.graceZone !== undefined ? this.config.graceZone : 5) / 100;
    const exponent = this.config.exponent !== undefined ? this.config.exponent : 2.0;

    this.metrics.forEach(metric => {
      const key = this.getMetricKey(metric);
      const val = this.latestValues[key];
      metric.currentVal = val;

      if (val === null || val === undefined || isNaN(val)) {
        metric.score = null;
        return;
      }

      const minVal = metric.min;
      const maxVal = metric.max;
      const targetVal = metric.target;

      // Handle clamp outside bounds
      if (val <= minVal || val >= maxVal) {
        metric.score = 0;
        sum += 0;
        validCount++;
        return;
      }

      // Calculate grace bounds
      const graceMin = targetVal - gracePct * (targetVal - minVal);
      const graceMax = targetVal + gracePct * (maxVal - targetVal);

      let score = 0;

      if (val >= graceMin && val <= graceMax) {
        score = 100;
      } else if (val < graceMin) {
        // Below target (between minVal and graceMin)
        const den = graceMin - minVal;
        const fraction = den > 0 ? (val - minVal) / den : 1.0;
        score = this.computeProfileScore(fraction, mode, exponent);
      } else {
        // Above target (between graceMax and maxVal)
        const den = maxVal - graceMax;
        const fraction = den > 0 ? (maxVal - val) / den : 1.0;
        score = this.computeProfileScore(fraction, mode, exponent);
      }

      metric.score = Math.max(0, Math.min(100, score));

      sum += metric.score;
      validCount++;
    });

    this.totalScore = validCount > 0 ? sum / validCount : null;
  }

  private computeProfileScore(fraction: number, mode: string, exponent: number): number {
    const f = Math.max(0, Math.min(1, fraction));
    if (mode === 'exponential') {
      return 100 * Math.pow(f, exponent);
    } else if (mode === 'sigmoid') {
      // Smooth cosine interpolation (S-curve)
      return 100 * (0.5 - 0.5 * Math.cos(Math.PI * f));
    } else {
      // default: linear
      return 100 * f;
    }
  }

  setupRealtime() {
    const deviceId = this.config.device.id;
    if (this.currentSubscribedDeviceId === deviceId && this.realtimeSubscription) {
      return;
    }

    this.unsubscribeRealtime();

    this.currentSubscribedDeviceId = deviceId;
    this.realtimeSubscription = this.measurementRealtime.onCreate$(deviceId).subscribe((msg: any) => {
      let measurement = msg;
      if (msg && msg.data) {
        measurement = msg.data.data || msg.data;
      }
      if (!measurement) return;

      let updated = false;
      this.metrics.forEach(metric => {
        const val = measurement[metric.fragment]?.[metric.series]?.value;
        if (val !== undefined && val !== null) {
          const key = this.getMetricKey(metric);
          this.latestValues[key] = Number(val);
          updated = true;
        }
      });

      if (updated) {
        this.calculateScore();
        this.changeRef.detectChanges();
      }
    });
  }

  unsubscribeRealtime() {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = undefined;
    }
    this.currentSubscribedDeviceId = undefined;
  }

  getStrokeDashoffset(): number {
    const score = this.totalScore !== null ? this.totalScore : 0;
    return 314.16 * (1 - score / 100);
  }

  getScoreColor(score: number | null): string {
    if (score === null) return '#cbd5e1';
    if (score >= 80) return '#25b875';
    if (score >= 50) return '#e67e22';
    return '#e74c3c';
  }
}
