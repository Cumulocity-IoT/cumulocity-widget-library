/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { IManagedObject } from '@c8y/client';

export type TargetScope = 'devices' | 'assets' | 'all';
export type ChartStyle = 'pie' | 'donut';
export type DateExtractionMode = 'none' | 'year' | 'yearMonth' | 'date';
export type ValueDisplayMode = 'count' | 'percentage' | 'both';
export type LegendPosition = 'bottom' | 'right' | 'top' | 'none';

export type ColorMode = 'automatic' | 'custom';

export interface FleetStatisticsConfig {
  targetScope?: TargetScope;
  queryFilter?: string;
  groupByProperty?: string;
  dateExtractionMode?: DateExtractionMode;
  fallbackLabel?: string;
  chartStyle?: ChartStyle;
  maxSlices?: number;
  showOtherGroup?: boolean;
  valueDisplay?: ValueDisplayMode;
  legendPosition?: LegendPosition;
  colorMode?: ColorMode;
  customColors?: string[];
  device?: { id?: string; name?: string };
}

export interface GroupedCategory {
  name: string;
  value: number;
  percentage?: number;
  matchingObjects: IManagedObject[];
}

export interface QueryTestResult {
  totalCount: number;
  distinctGroupsCount: number;
  sampleGroups: { name: string; count: number }[];
  errorMessage?: string;
}

export const PRESET_CONFIGURATIONS = [
  {
    id: 'firmware',
    label: 'Device Firmware Versions',
    description: 'All devices grouped by their firmware version (c8y_Firmware.version)',
    config: {
      targetScope: 'devices' as TargetScope,
      queryFilter: "has(c8y_Firmware)",
      groupByProperty: 'c8y_Firmware.version',
      dateExtractionMode: 'none' as DateExtractionMode,
      fallbackLabel: 'No Firmware Set',
      chartStyle: 'donut' as ChartStyle,
      maxSlices: 10
    }
  },
  {
    id: 'hardware',
    label: 'Device Hardware Models',
    description: 'All devices grouped by their hardware model (c8y_Hardware.model)',
    config: {
      targetScope: 'devices' as TargetScope,
      queryFilter: "has(c8y_Hardware)",
      groupByProperty: 'c8y_Hardware.model',
      dateExtractionMode: 'none' as DateExtractionMode,
      fallbackLabel: 'Generic / Unknown Model',
      chartStyle: 'donut' as ChartStyle,
      maxSlices: 10
    }
  },
  {
    id: 'device_type',
    label: 'Device Types',
    description: 'All devices grouped by device type',
    config: {
      targetScope: 'devices' as TargetScope,
      queryFilter: '',
      groupByProperty: 'type',
      dateExtractionMode: 'none' as DateExtractionMode,
      fallbackLabel: 'Untyped Devices',
      chartStyle: 'pie' as ChartStyle,
      maxSlices: 10
    }
  },
  {
    id: 'availability',
    label: 'Device Availability Status',
    description: 'All devices grouped by availability status (c8y_Availability.status)',
    config: {
      targetScope: 'devices' as TargetScope,
      queryFilter: "has(c8y_Availability)",
      groupByProperty: 'c8y_Availability.status',
      dateExtractionMode: 'none' as DateExtractionMode,
      fallbackLabel: 'Unknown Status',
      chartStyle: 'donut' as ChartStyle,
      maxSlices: 10
    }
  },
  {
    id: 'software',
    label: 'Installed Software Version',
    description: 'Devices with specific software installed, grouped by version',
    config: {
      targetScope: 'devices' as TargetScope,
      queryFilter: "has(c8y_SoftwareList)",
      groupByProperty: "c8y_SoftwareList[name='Agent'].version",
      dateExtractionMode: 'none' as DateExtractionMode,
      fallbackLabel: 'Version Not Reported',
      chartStyle: 'donut' as ChartStyle,
      maxSlices: 10
    }
  },
  {
    id: 'asset_type',
    label: 'Asset Types',
    description: 'All assets grouped by asset type',
    config: {
      targetScope: 'assets' as TargetScope,
      queryFilter: '',
      groupByProperty: 'type',
      dateExtractionMode: 'none' as DateExtractionMode,
      fallbackLabel: 'General Asset',
      chartStyle: 'pie' as ChartStyle,
      maxSlices: 10
    }
  },
  {
    id: 'deployment_year',
    label: 'Asset Deployment / Creation Year',
    description: 'All assets grouped by the year they were created or deployed',
    config: {
      targetScope: 'assets' as TargetScope,
      queryFilter: '',
      groupByProperty: 'creationTime',
      dateExtractionMode: 'year' as DateExtractionMode,
      fallbackLabel: 'Unknown Date',
      chartStyle: 'donut' as ChartStyle,
      maxSlices: 10
    }
  }
];

/**
 * Builds the full OData inventory query parameter combining the target scope with user filter.
 */
export function buildInventoryQuery(scope: TargetScope = 'devices', customFilter?: string): string {
  const cleanFilter = (customFilter || '').trim();
  let baseScopeFilter = '';

  if (scope === 'devices') {
    baseScopeFilter = 'has(c8y_IsDevice)';
  } else if (scope === 'assets') {
    baseScopeFilter = 'has(c8y_IsAsset)';
  }

  // If both base scope and custom filter exist
  if (baseScopeFilter && cleanFilter) {
    // Strip outer $filter=(...) if user already provided it
    let unwrappedCustom = cleanFilter;
    if (unwrappedCustom.startsWith('$filter=')) {
      unwrappedCustom = unwrappedCustom.slice(8).trim();
      if (unwrappedCustom.startsWith('(') && unwrappedCustom.endsWith(')')) {
        unwrappedCustom = unwrappedCustom.slice(1, -1).trim();
      }
    }
    return `$filter=(${baseScopeFilter} and (${unwrappedCustom}))`;
  }

  if (baseScopeFilter) {
    return `$filter=(${baseScopeFilter})`;
  }

  if (cleanFilter) {
    if (cleanFilter.startsWith('$filter=')) {
      return cleanFilter;
    }
    return `$filter=(${cleanFilter})`;
  }

  return '';
}

/**
 * Resolves a property path from a managedObject, handling:
 * - Simple paths: "type", "c8y_Availability.status"
 * - Nested objects: "c8y_Firmware.version"
 * - Array predicate matching: "c8y_SoftwareList[name='Agent'].version"
 * - Array direct paths: "c8y_SoftwareList.0.version" or "c8y_SoftwareList.name"
 * - Date transformations (year, yearMonth, date)
 */
export function extractPropertyValue(
  mo: IManagedObject | any,
  path: string,
  dateExtractionMode: DateExtractionMode = 'none',
  fallbackLabel: string = 'Unknown'
): string | string[] {
  if (!mo || !path) {
    return fallbackLabel;
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return fallbackLabel;
  }

  const rawValue = resolvePath(mo, trimmedPath);

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return fallbackLabel;
  }

  if (Array.isArray(rawValue)) {
    const formatted = rawValue
      .map(item => formatSingleValue(item, dateExtractionMode, fallbackLabel))
      .filter(item => item !== fallbackLabel || rawValue.length === 1);
    return formatted.length > 0 ? formatted : fallbackLabel;
  }

  return formatSingleValue(rawValue, dateExtractionMode, fallbackLabel);
}

function formatSingleValue(
  value: any,
  dateExtractionMode: DateExtractionMode,
  fallbackLabel: string
): string {
  if (value === null || value === undefined || value === '') {
    return fallbackLabel;
  }

  if (typeof value === 'object') {
    // If an object is returned and has name or value or version
    if (value.name !== undefined) return String(value.name);
    if (value.version !== undefined) return String(value.version);
    if (value.value !== undefined) return String(value.value);
    return JSON.stringify(value);
  }

  const strValue = String(value).trim();
  if (!strValue) return fallbackLabel;

  if (dateExtractionMode && dateExtractionMode !== 'none') {
    const date = new Date(strValue);
    if (!isNaN(date.getTime())) {
      const fullYear = date.getFullYear();
      if (dateExtractionMode === 'year') {
        return String(fullYear);
      }
      const month = String(date.getMonth() + 1).padStart(2, '0');
      if (dateExtractionMode === 'yearMonth') {
        return `${fullYear}-${month}`;
      }
      const day = String(date.getDate()).padStart(2, '0');
      if (dateExtractionMode === 'date') {
        return `${fullYear}-${month}-${day}`;
      }
    }
  }

  return strValue;
}

function resolvePath(obj: any, path: string): any {
  if (obj === null || obj === undefined) return undefined;

  // Split tokens by dot, while preserving array predicate bracket expressions like [name='foo']
  const tokenRegex = /([^.\[\]]+|\[[^\]]+\])/g;
  const matches = path.match(tokenRegex);
  if (!matches || matches.length === 0) return undefined;

  let current: any = obj;

  for (let i = 0; i < matches.length; i++) {
    if (current === null || current === undefined) return undefined;

    const token = matches[i];

    // Array predicate: e.g. [name='Agent'] or [type="sensor"] or [0]
    if (token.startsWith('[') && token.endsWith(']')) {
      const inside = token.slice(1, -1).trim();

      // Number index: e.g. [0]
      if (/^\d+$/.test(inside)) {
        const index = parseInt(inside, 10);
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return undefined;
        }
      } else {
        // Key-value predicate: e.g. name='Agent' or name="Agent" or key=value
        const predMatch = inside.match(/^([a-zA-Z0-9_]+)\s*=\s*['"]?([^'"]+)['"]?$/);
        if (predMatch) {
          const [, propName, targetVal] = predMatch;
          if (Array.isArray(current)) {
            current = current.find(item => item && String(item[propName]) === targetVal);
          } else if (typeof current === 'object') {
            current = String(current[propName]) === targetVal ? current : undefined;
          } else {
            return undefined;
          }
        } else if (Array.isArray(current)) {
          return current;
        }
      }
    } else {
      // Normal property lookup
      if (Array.isArray(current)) {
        // If current is an array, map every element to property
        current = current
          .map(item => (item && typeof item === 'object' ? item[token] : undefined))
          .filter(v => v !== undefined && v !== null);
      } else if (typeof current === 'object') {
        current = current[token];
      } else {
        return undefined;
      }
    }
  }

  return current;
}

export const DEFAULT_CUSTOM_COLORS = [
  '#1776bf', '#38bdf8', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#06b6d4', '#f97316'
];

/**
 * Reads the official theme brand shade tokens (--c8y-brand-10 through --c8y-brand-80)
 * defined by the tenant branding, ordered for high adjacent contrast in charts.
 */
export function getThemeBrandShades(): string[] {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }

  const rootStyle = getComputedStyle(document.documentElement);
  
  // Interleaved contrast sequence using the official 8 brand tokens
  const tokenNames = [
    '--c8y-brand-primary', // base brand color (matches --c8y-brand-40)
    '--c8y-brand-60',      // light tint (matches --c8y-brand-light)
    '--c8y-brand-20',      // dark shade
    '--c8y-brand-50',      // medium light
    '--c8y-brand-10',      // deepest shade (matches --c8y-brand-dark)
    '--c8y-brand-70',      // very light tint
    '--c8y-brand-30',      // medium dark
    '--c8y-brand-80'       // pale tint
  ];

  const shades: string[] = [];
  for (const token of tokenNames) {
    const val = rootStyle.getPropertyValue(token)?.trim();
    if (val) {
      shades.push(val);
    }
  }

  return shades;
}

/**
 * Generates an elegant, cohesive monochromatic color palette derived strictly
 * from the tenant's primary branding color (tints & shades along the brand hue).
 */
export function generateBrandDerivedPalette(
  baseColorHex: string = '#1776bf',
  count: number = 10
): string[] {
  const baseHsl = hexToHsl(baseColorHex);
  const palette: string[] = [];

  // Slice 0 is always the exact base brand color
  palette.push(normalizeHexColor(baseColorHex));

  if (count <= 1) return palette;

  // Interleaved high-contrast offsets ensuring adjacent slices are clearly distinguishable
  const lightnessOffsets = [
    +18, -15, +30, -26, +40, -34, +10, -8, +24, -20, +36, -30
  ];

  for (let i = 1; i < count; i++) {
    const offset = lightnessOffsets[(i - 1) % lightnessOffsets.length];
    const targetL = Math.max(18, Math.min(86, baseHsl.l + offset));
    
    let targetS = baseHsl.s;
    if (targetL > 75) {
      targetS = Math.min(baseHsl.s + 10, 95);
    } else if (targetL < 30) {
      targetS = Math.max(baseHsl.s - 8, 45);
    }

    palette.push(hslToHex(baseHsl.h, targetS, targetL));
  }

  return palette;
}

export function hexToHsl(colorStr: string): { h: number; s: number; l: number } {
  let cleanStr = (colorStr || '').trim();

  // If rgb/rgba format e.g. "rgb(23, 118, 191)"
  const rgbMatch = cleanStr.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  let r = 23, g = 118, b = 191;

  if (rgbMatch) {
    r = parseInt(rgbMatch[1], 10);
    g = parseInt(rgbMatch[2], 10);
    b = parseInt(rgbMatch[3], 10);
  } else {
    let cleanHex = cleanStr.replace(/^#/, '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length === 6) {
      r = parseInt(cleanHex.substring(0, 2), 16);
      g = parseInt(cleanHex.substring(2, 4), 16);
      b = parseInt(cleanHex.substring(4, 6), 16);
    }
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  h = ((h % 360) + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function normalizeHexColor(hex: string): string {
  let clean = hex.trim();
  if (!clean.startsWith('#')) clean = '#' + clean;
  if (clean.length === 4) {
    clean = '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
  }
  return clean;
}

