/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HeatLevel {
  min: number;
  max: number | null; // null represents open-ended
  color: string;
}

export interface WidgetConfig {
  device?: {
    id: string;
    name: string;
  };
  timeRange?: 'last24h' | 'lastWeek' | 'lastMonth' | 'custom';
  customFrom?: string;
  customTo?: string;
  aggregationLevel?: 'hourly' | 'daily' | '2h' | '4h' | '6h';
  heatLevels?: HeatLevel[];
}
