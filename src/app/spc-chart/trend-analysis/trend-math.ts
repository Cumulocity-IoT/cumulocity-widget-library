/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ForecastPoint, TrendConfig, TrendDataPoint, TrendForecastResult } from './trend.model';

/**
 * Converts a duration and time unit into milliseconds.
 */
export function durationToMilliseconds(duration: number, unit: string = 'hours'): number {
  const d = Math.max(0, duration || 0);
  switch (unit) {
    case 'minutes':
      return d * 60 * 1000;
    case 'hours':
      return d * 60 * 60 * 1000;
    case 'days':
      return d * 24 * 60 * 60 * 1000;
    case 'weeks':
      return d * 7 * 24 * 60 * 60 * 1000;
    case 'months':
      return d * 30 * 24 * 60 * 60 * 1000;
    default:
      return d * 60 * 60 * 1000;
  }
}

/**
 * Filters and extracts training points according to the TrendConfig trainingWindow options.
 */
export function selectTrainingPoints(
  points: TrendDataPoint[],
  config: TrendConfig
): TrendDataPoint[] {
  if (!points || points.length < 2) {
    return points || [];
  }

  const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);

  if (config.trainingWindow === 'last_n_points') {
    const count = Math.max(2, Math.min(sorted.length, config.lastPointsCount || 50));
    return sorted.slice(-count);
  }

  if (config.trainingWindow === 'last_percentage') {
    const percentage = Math.max(1, Math.min(100, config.lastPercentage || 50));
    const firstTs = sorted[0].timestamp;
    const lastTs = sorted[sorted.length - 1].timestamp;
    const range = lastTs - firstTs;
    const cutoff = lastTs - (range * (percentage / 100));
    const subset = sorted.filter(p => p.timestamp >= cutoff);
    return subset.length >= 2 ? subset : sorted.slice(-2);
  }

  return sorted;
}

/**
 * Linear Regression using Ordinary Least Squares (OLS) with confidence interval computation.
 */
export function computeLinearRegression(
  trainingPoints: TrendDataPoint[],
  lastTimestamp: number,
  forecastDurationMs: number,
  numForecastSteps = 30
): TrendForecastResult {
  const n = trainingPoints.length;
  if (n < 2) {
    return { historicalFit: [], forecast: [] };
  }

  const t0 = trainingPoints[0].timestamp;
  const tEnd = trainingPoints[n - 1].timestamp;
  const timeScale = (tEnd - t0) || 1;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = (trainingPoints[i].timestamp - t0) / timeScale;
    const y = trainingPoints[i].value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denom = n * sumX2 - sumX * sumX;
  const slopeNorm = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const interceptNorm = (sumY - slopeNorm * sumX) / n;

  const meanX = sumX / n;
  let ssTot = 0;
  let ssRes = 0;
  let sumDiffX2 = 0;
  const meanY = sumY / n;

  for (let i = 0; i < n; i++) {
    const x = (trainingPoints[i].timestamp - t0) / timeScale;
    const y = trainingPoints[i].value;
    const yPred = interceptNorm + slopeNorm * x;
    ssRes += (y - yPred) * (y - yPred);
    ssTot += (y - meanY) * (y - meanY);
    sumDiffX2 += (x - meanX) * (x - meanX);
  }

  const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 1;
  const stdError = n > 2 ? Math.sqrt(ssRes / (n - 2)) : 0;
  const zScore = 1.96; // 95% confidence

  // Generate historical fit
  const historicalFit: ForecastPoint[] = trainingPoints.map(p => {
    const x = (p.timestamp - t0) / timeScale;
    const pred = interceptNorm + slopeNorm * x;
    return {
      timestamp: p.timestamp,
      value: pred
    };
  });

  // Generate future forecast
  const forecast: ForecastPoint[] = [];
  if (forecastDurationMs > 0) {
    const stepMs = forecastDurationMs / numForecastSteps;
    for (let step = 0; step <= numForecastSteps; step++) {
      const ts = lastTimestamp + step * stepMs;
      const x = (ts - t0) / timeScale;
      const pred = interceptNorm + slopeNorm * x;
      const leverage = (1 / n) + ((x - meanX) * (x - meanX)) / (sumDiffX2 || 1);
      const margin = zScore * stdError * Math.sqrt(1 + leverage);

      forecast.push({
        timestamp: Math.round(ts),
        value: pred,
        lowerConfidence: pred - margin,
        upperConfidence: pred + margin
      });
    }
  }

  return {
    historicalFit,
    forecast,
    rSquared,
    slope: slopeNorm / timeScale
  };
}

/**
 * Solves a linear system of equations A * x = b using Gaussian elimination with partial pivoting.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) {
        maxRow = k;
      }
    }
    const temp = M[i];
    M[i] = M[maxRow];
    M[maxRow] = temp;

    if (Math.abs(M[i][i]) < 1e-12) {
      continue;
    }

    for (let k = i + 1; k < n; k++) {
      const factor = M[k][i] / M[i][i];
      for (let j = i; j <= n; j++) {
        M[k][j] -= factor * M[i][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) < 1e-12 ? 0 : sum / M[i][i];
  }

  return x;
}

/**
 * Polynomial Regression of degree 2 (quadratic) or degree 3 (cubic).
 */
export function computePolynomialRegression(
  trainingPoints: TrendDataPoint[],
  degree: 2 | 3,
  lastTimestamp: number,
  forecastDurationMs: number,
  numForecastSteps = 30
): TrendForecastResult {
  const n = trainingPoints.length;
  if (n <= degree) {
    return computeLinearRegression(trainingPoints, lastTimestamp, forecastDurationMs, numForecastSteps);
  }

  const t0 = trainingPoints[0].timestamp;
  const tEnd = trainingPoints[n - 1].timestamp;
  const timeScale = (tEnd - t0) || 1;

  const d = degree;
  const matrixSize = d + 1;
  const X_powers: number[] = new Array(2 * d + 1).fill(0);
  const XY_powers: number[] = new Array(matrixSize).fill(0);

  for (let i = 0; i < n; i++) {
    const x = (trainingPoints[i].timestamp - t0) / timeScale;
    const y = trainingPoints[i].value;

    let xPow = 1;
    for (let p = 0; p <= 2 * d; p++) {
      X_powers[p] += xPow;
      if (p <= d) {
        XY_powers[p] += xPow * y;
      }
      xPow *= x;
    }
  }

  const A: number[][] = [];
  for (let row = 0; row < matrixSize; row++) {
    A[row] = [];
    for (let col = 0; col < matrixSize; col++) {
      A[row][col] = X_powers[row + col];
    }
  }

  const coeffs = solveLinearSystem(A, XY_powers);

  const evalPoly = (x: number): number => {
    let res = 0;
    let xPow = 1;
    for (let p = 0; p <= d; p++) {
      res += (coeffs[p] || 0) * xPow;
      xPow *= x;
    }
    return res;
  };

  let ssTot = 0;
  let ssRes = 0;
  const meanY = trainingPoints.reduce((acc, p) => acc + p.value, 0) / n;

  for (let i = 0; i < n; i++) {
    const x = (trainingPoints[i].timestamp - t0) / timeScale;
    const y = trainingPoints[i].value;
    const yPred = evalPoly(x);
    ssRes += (y - yPred) * (y - yPred);
    ssTot += (y - meanY) * (y - meanY);
  }

  const rSquared = ssTot > 0 ? Math.max(0, 1 - (ssRes / ssTot)) : 1;
  const stdError = n > matrixSize ? Math.sqrt(ssRes / (n - matrixSize)) : 0;
  const zScore = 1.96;

  const historicalFit: ForecastPoint[] = trainingPoints.map(p => {
    const x = (p.timestamp - t0) / timeScale;
    return {
      timestamp: p.timestamp,
      value: evalPoly(x)
    };
  });

  const forecast: ForecastPoint[] = [];
  if (forecastDurationMs > 0) {
    const stepMs = forecastDurationMs / numForecastSteps;
    for (let step = 0; step <= numForecastSteps; step++) {
      const ts = lastTimestamp + step * stepMs;
      const x = (ts - t0) / timeScale;
      const pred = evalPoly(x);
      const margin = zScore * stdError * Math.sqrt(1 + (1 / n) + Math.pow(x - 0.5, 2));

      forecast.push({
        timestamp: Math.round(ts),
        value: pred,
        lowerConfidence: pred - margin,
        upperConfidence: pred + margin
      });
    }
  }

  return {
    historicalFit,
    forecast,
    rSquared
  };
}

/**
 * Holt's Linear Exponential Smoothing with optional Damping Factor.
 * Handles Level (L) and Trend (T) dynamically.
 */
export function computeHoltSmoothing(
  trainingPoints: TrendDataPoint[],
  alpha = 0.3,
  beta = 0.1,
  phi = 1.0,
  lastTimestamp: number,
  forecastDurationMs: number,
  numForecastSteps = 30
): TrendForecastResult {
  const n = trainingPoints.length;
  if (n < 2) {
    return { historicalFit: [], forecast: [] };
  }

  const a = Math.max(0.01, Math.min(1.0, alpha));
  const b = Math.max(0.01, Math.min(1.0, beta));
  const damping = Math.max(0.7, Math.min(1.0, phi || 1.0));

  // Initialize level and trend
  let level = trainingPoints[0].value;
  let trend = (trainingPoints[1].value - trainingPoints[0].value);

  const historicalFit: ForecastPoint[] = [
    {
      timestamp: trainingPoints[0].timestamp,
      value: level
    }
  ];

  let sumSquaredDiff = 0;

  for (let i = 1; i < n; i++) {
    const y = trainingPoints[i].value;
    const prevLevel = level;
    const prevTrend = trend;

    level = a * y + (1 - a) * (prevLevel + damping * prevTrend);
    trend = b * (level - prevLevel) + (1 - b) * damping * prevTrend;

    const fitVal = prevLevel + damping * prevTrend;
    sumSquaredDiff += (y - fitVal) * (y - fitVal);

    historicalFit.push({
      timestamp: trainingPoints[i].timestamp,
      value: level
    });
  }

  const stdError = Math.sqrt(sumSquaredDiff / Math.max(1, n - 1));
  const zScore = 1.96;

  // Compute average time delta between points to scale step units
  const totalTrainingTime = trainingPoints[n - 1].timestamp - trainingPoints[0].timestamp;
  const avgDeltaT = Math.max(1000, totalTrainingTime / Math.max(1, n - 1));

  const forecast: ForecastPoint[] = [];
  if (forecastDurationMs > 0) {
    const stepMs = forecastDurationMs / numForecastSteps;
    for (let step = 0; step <= numForecastSteps; step++) {
      const ts = lastTimestamp + step * stepMs;
      const timeDeltaMs = ts - lastTimestamp;
      const hSteps = timeDeltaMs / avgDeltaT;

      let trendContribution = 0;
      if (Math.abs(damping - 1.0) < 0.001) {
        trendContribution = hSteps * trend;
      } else {
        // Damped series sum: trend * sum_{j=1}^h phi^j
        trendContribution = trend * ((damping * (1 - Math.pow(damping, hSteps))) / (1 - damping));
      }

      const pred = level + trendContribution;
      // Confidence expands as square root of step horizon
      const horizonFactor = Math.sqrt(1 + hSteps * 0.2);
      const margin = zScore * stdError * horizonFactor;

      forecast.push({
        timestamp: Math.round(ts),
        value: pred,
        lowerConfidence: pred - margin,
        upperConfidence: pred + margin
      });
    }
  }

  return {
    historicalFit,
    forecast
  };
}

/**
 * Moving Average Velocity Trend extrapolation.
 * Uses a rolling window to compute recent average velocity (dy/dt) and projects linearly.
 */
export function computeMovingAverageTrend(
  trainingPoints: TrendDataPoint[],
  windowSize = 10,
  lastTimestamp: number,
  forecastDurationMs: number,
  numForecastSteps = 30
): TrendForecastResult {
  const n = trainingPoints.length;
  if (n < 2) {
    return { historicalFit: [], forecast: [] };
  }

  const k = Math.max(2, Math.min(n, windowSize || 10));
  const windowPoints = trainingPoints.slice(-k);

  // Compute slope over the last k points via simple regression
  const linearResult = computeLinearRegression(windowPoints, lastTimestamp, forecastDurationMs, numForecastSteps);

  return {
    historicalFit: linearResult.historicalFit,
    forecast: linearResult.forecast,
    slope: linearResult.slope
  };
}

/**
 * Main dispatcher to run trend analysis according to configuration.
 */
export function runTrendAnalysis(
  rawPoints: Array<[number, number] | { timestamp: number; value: number }>,
  config: TrendConfig,
  customForecastDurationMs?: number
): TrendForecastResult | null {
  if (!rawPoints || rawPoints.length < 2 || !config?.enabled) {
    return null;
  }

  // Normalize points to standard { timestamp, value }
  const points: TrendDataPoint[] = rawPoints
    .map(p => {
      if (Array.isArray(p)) {
        return { timestamp: Number(p[0]), value: Number(p[1]) };
      }
      return { timestamp: Number(p.timestamp), value: Number(p.value) };
    })
    .filter(p => !isNaN(p.timestamp) && !isNaN(p.value) && isFinite(p.timestamp) && isFinite(p.value))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (points.length < 2) {
    return null;
  }

  const trainingPoints = selectTrainingPoints(points, config);
  const lastPoint = points[points.length - 1];
  const lastTimestamp = lastPoint.timestamp;
  const forecastDurationMs = customForecastDurationMs !== undefined
    ? customForecastDurationMs
    : durationToMilliseconds(config.forecastDuration || 2, config.forecastUnit || 'hours');

  const method = config.method || 'holt';

  switch (method) {
    case 'linear':
      return computeLinearRegression(trainingPoints, lastTimestamp, forecastDurationMs);
    case 'polynomial':
      return computePolynomialRegression(
        trainingPoints,
        config.polynomialDegree || 2,
        lastTimestamp,
        forecastDurationMs
      );
    case 'movingAverage':
      return computeMovingAverageTrend(
        trainingPoints,
        config.movingAverageWindow || 10,
        lastTimestamp,
        forecastDurationMs
      );
    case 'holt':
    default:
      return computeHoltSmoothing(
        trainingPoints,
        config.holtAlpha ?? 0.3,
        config.holtBeta ?? 0.1,
        config.holtDamping ?? 1.0,
        lastTimestamp,
        forecastDurationMs
      );
  }
}
