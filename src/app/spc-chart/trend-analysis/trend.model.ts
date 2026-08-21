/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export type TrendMethod = 'linear' | 'holt' | 'polynomial' | 'movingAverage';
export type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
export type TrendLineStyle = 'dashed' | 'dotted' | 'solid';

export interface TrendConfig {
  enabled?: boolean;
  method?: TrendMethod;
  
  // Future Forecast Horizon
  forecastDuration?: number; // e.g., 2
  forecastUnit?: TimeUnit; // e.g., 'hours'
  
  // Training Scope
  trainingWindow?: 'all' | 'last_n_points' | 'last_percentage';
  lastPointsCount?: number; // e.g. 50
  lastPercentage?: number; // e.g. 50 (%)
  
  // Holt's Linear Exponential Smoothing Parameters
  holtAlpha?: number; // Level smoothing (0.01 - 1.0, default 0.3)
  holtBeta?: number; // Trend smoothing (0.01 - 1.0, default 0.1)
  holtDamping?: number; // Damping factor phi (0.8 - 1.0, default 1.0)
  
  // Polynomial Regression Parameters
  polynomialDegree?: 2 | 3; // Quadratic or Cubic
  
  // Moving Average Velocity Parameters
  movingAverageWindow?: number; // Window size in points (default 10)
  
  // Visual Styling
  color?: string; // Hex color (e.g. '#FF7F0E')
  lineStyle?: TrendLineStyle;
  lineWidth?: number; // 1-5 px
  showConfidenceBand?: boolean;
  confidenceBandOpacity?: number; // 0.05 - 0.5 (default 0.15)
  targetDatapointIndex?: number; // index of datapoint to forecast if multiple exist
}

export interface TrendDataPoint {
  timestamp: number; // epoch ms
  value: number;
}

export interface ForecastPoint {
  timestamp: number; // epoch ms
  value: number; // predicted value
  lowerConfidence?: number; // lower uncertainty bound
  upperConfidence?: number; // upper uncertainty bound
}

export interface TrendForecastResult {
  historicalFit: ForecastPoint[]; // fitted curve over historical data
  forecast: ForecastPoint[]; // future projected points
  rSquared?: number; // coefficient of determination (for regression methods)
  slope?: number; // rate of change per ms
}
