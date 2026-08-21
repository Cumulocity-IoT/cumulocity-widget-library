/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  computeLinearRegression,
  computePolynomialRegression,
  computeHoltSmoothing,
  computeMovingAverageTrend,
  durationToMilliseconds,
  runTrendAnalysis,
  selectTrainingPoints
} from './trend-math';
import { TrendConfig, TrendDataPoint } from './trend.model';

describe('Trend Math Engine', () => {
  const baseTime = 1700000000000;
  const hourMs = 3600000;

  // Generate synthetic linear data: y = 2 * step + 10
  const linearData: TrendDataPoint[] = Array.from({ length: 10 }, (_, i) => ({
    timestamp: baseTime + i * hourMs,
    value: 10 + 2 * i
  }));

  describe('durationToMilliseconds', () => {
    it('should correctly convert minutes, hours, days, weeks, months', () => {
      expect(durationToMilliseconds(30, 'minutes')).toBe(30 * 60 * 1000);
      expect(durationToMilliseconds(2, 'hours')).toBe(2 * 3600 * 1000);
      expect(durationToMilliseconds(1, 'days')).toBe(24 * 3600 * 1000);
      expect(durationToMilliseconds(2, 'weeks')).toBe(14 * 24 * 3600 * 1000);
      expect(durationToMilliseconds(1, 'months')).toBe(30 * 24 * 3600 * 1000);
    });
  });

  describe('selectTrainingPoints', () => {
    it('should return all points when window is all', () => {
      const selected = selectTrainingPoints(linearData, { trainingWindow: 'all' });
      expect(selected.length).toBe(10);
    });

    it('should return last N points', () => {
      const selected = selectTrainingPoints(linearData, {
        trainingWindow: 'last_n_points',
        lastPointsCount: 4
      });
      expect(selected.length).toBe(4);
      expect(selected[0].value).toBe(linearData[6].value);
    });

    it('should return points within the last percentage', () => {
      const selected = selectTrainingPoints(linearData, {
        trainingWindow: 'last_percentage',
        lastPercentage: 50
      });
      expect(selected.length).toBeGreaterThan(2);
      expect(selected.length).toBeLessThan(10);
    });
  });

  describe('computeLinearRegression', () => {
    it('should accurately fit a perfect linear trend with R^2 = 1', () => {
      const lastTs = linearData[linearData.length - 1].timestamp;
      const forecastDuration = 2 * hourMs;
      const result = computeLinearRegression(linearData, lastTs, forecastDuration, 2);

      expect(result.rSquared).toBeCloseTo(1, 4);
      expect(result.historicalFit.length).toBe(10);
      expect(result.forecast.length).toBe(3); // 0, 1, 2 steps

      // Step 2 should be y = 10 + 2 * (9 + 2) = 32
      const finalForecast = result.forecast[result.forecast.length - 1];
      expect(finalForecast.value).toBeCloseTo(32, 1);
      expect(finalForecast.lowerConfidence).toBeDefined();
      expect(finalForecast.upperConfidence).toBeDefined();
    });
  });

  describe('computePolynomialRegression', () => {
    it('should fit a quadratic curve (degree 2)', () => {
      // Synthetic quadratic data: y = step^2
      const quadData: TrendDataPoint[] = Array.from({ length: 10 }, (_, i) => ({
        timestamp: baseTime + i * hourMs,
        value: i * i
      }));

      const lastTs = quadData[quadData.length - 1].timestamp;
      const result = computePolynomialRegression(quadData, 2, lastTs, hourMs, 2);

      expect(result.rSquared).toBeGreaterThan(0.99);
      expect(result.forecast.length).toBe(3);
    });
  });

  describe('computeHoltSmoothing', () => {
    it('should smoothly follow trend and project forward', () => {
      const lastTs = linearData[linearData.length - 1].timestamp;
      const result = computeHoltSmoothing(linearData, 0.4, 0.2, 1.0, lastTs, 2 * hourMs, 4);

      expect(result.historicalFit.length).toBe(10);
      expect(result.forecast.length).toBe(5);
      const lastForecast = result.forecast[result.forecast.length - 1];
      expect(lastForecast.value).toBeGreaterThan(linearData[linearData.length - 1].value);
    });
  });

  describe('computeMovingAverageTrend', () => {
    it('should extrapolate trend using rolling window', () => {
      const lastTs = linearData[linearData.length - 1].timestamp;
      const result = computeMovingAverageTrend(linearData, 5, lastTs, 2 * hourMs, 4);

      expect(result.forecast.length).toBe(5);
      expect(result.forecast[result.forecast.length - 1].value).toBeCloseTo(32, 1);
    });
  });

  describe('runTrendAnalysis', () => {
    it('should return null when disabled or insufficient points', () => {
      expect(runTrendAnalysis(linearData, { enabled: false })).toBeNull();
      expect(runTrendAnalysis([linearData[0]], { enabled: true })).toBeNull();
    });

    it('should execute Holt smoothing by default when enabled', () => {
      const config: TrendConfig = {
        enabled: true,
        method: 'holt',
        forecastDuration: 2,
        forecastUnit: 'hours'
      };
      const result = runTrendAnalysis(linearData, config);
      expect(result).not.toBeNull();
      expect(result?.forecast.length).toBeGreaterThan(0);
    });
  });
});
