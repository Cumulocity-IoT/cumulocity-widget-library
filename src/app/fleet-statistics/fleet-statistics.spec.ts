/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  buildInventoryQuery,
  extractPropertyValue,
  generateBrandDerivedPalette,
  hexToHsl,
  hslToHex
} from './fleet-statistics.model';

describe('FleetStatistics Model & Utilities', () => {
  describe('buildInventoryQuery', () => {
    it('should build device scope query without custom filter', () => {
      const q = buildInventoryQuery('devices');
      expect(q).toBe('$filter=(has(c8y_IsDevice))');
    });

    it('should build asset scope query without custom filter', () => {
      const q = buildInventoryQuery('assets');
      expect(q).toBe('$filter=(has(c8y_IsAsset))');
    });

    it('should return empty string for all scope without custom filter', () => {
      const q = buildInventoryQuery('all');
      expect(q).toBe('');
    });

    it('should combine device scope with custom filter', () => {
      const q = buildInventoryQuery('devices', "type eq 'c8y_Linux'");
      expect(q).toBe("$filter=(has(c8y_IsDevice) and (type eq 'c8y_Linux'))");
    });

    it('should combine asset scope with unwrapped $filter=(...) custom filter', () => {
      const q = buildInventoryQuery('assets', "$filter=(type eq 'c8y_Building')");
      expect(q).toBe("$filter=(has(c8y_IsAsset) and (type eq 'c8y_Building'))");
    });

    it('should handle custom filter for all scope', () => {
      const q = buildInventoryQuery('all', "has(c8y_Firmware)");
      expect(q).toBe("$filter=(has(c8y_Firmware))");
    });
  });

  describe('extractPropertyValue', () => {
    const mockMo = {
      id: '12345',
      name: 'Test Device 1',
      type: 'c8y_Linux',
      creationTime: '2024-05-18T14:30:00.000Z',
      c8y_Firmware: {
        name: 'LinuxOS',
        version: '2.4.1'
      },
      c8y_Hardware: {
        model: 'RaspberryPi 4'
      },
      c8y_Availability: {
        status: 'AVAILABLE'
      },
      c8y_SoftwareList: [
        { name: 'c8y-agent', version: '10.18.0' },
        { name: 'custom-service', version: '1.0.3' }
      ]
    };

    it('should extract top-level property', () => {
      const val = extractPropertyValue(mockMo, 'type');
      expect(val).toBe('c8y_Linux');
    });

    it('should extract nested object property (dot notation)', () => {
      const val = extractPropertyValue(mockMo, 'c8y_Firmware.version');
      expect(val).toBe('2.4.1');
    });

    it('should extract nested hardware model', () => {
      const val = extractPropertyValue(mockMo, 'c8y_Hardware.model');
      expect(val).toBe('RaspberryPi 4');
    });

    it('should extract array element by predicate [name=...]', () => {
      const val = extractPropertyValue(mockMo, "c8y_SoftwareList[name='c8y-agent'].version");
      expect(val).toBe('10.18.0');
    });

    it('should extract array element by index [0]', () => {
      const val = extractPropertyValue(mockMo, 'c8y_SoftwareList[0].name');
      expect(val).toBe('c8y-agent');
    });

    it('should extract date as year when dateExtractionMode is year', () => {
      const val = extractPropertyValue(mockMo, 'creationTime', 'year');
      expect(val).toBe('2024');
    });

    it('should extract date as yearMonth when dateExtractionMode is yearMonth', () => {
      const val = extractPropertyValue(mockMo, 'creationTime', 'yearMonth');
      expect(val).toBe('2024-05');
    });

    it('should extract date as date when dateExtractionMode is date', () => {
      const val = extractPropertyValue(mockMo, 'creationTime', 'date');
      expect(val).toBe('2024-05-18');
    });

    it('should return fallbackLabel when property does not exist', () => {
      const val = extractPropertyValue(mockMo, 'non_existent_property', 'none', 'Not Specified');
      expect(val).toBe('Not Specified');
    });

    it('should return fallbackLabel when managedObject is empty', () => {
      const val = extractPropertyValue(null, 'type', 'none', 'Unknown');
      expect(val).toBe('Unknown');
    });
  });

  describe('Color Derivation Utilities', () => {
    it('should convert hex to HSL correctly', () => {
      const hsl = hexToHsl('#1776bf');
      expect(hsl.h).toBeGreaterThanOrEqual(200);
      expect(hsl.h).toBeLessThanOrEqual(215);
      expect(hsl.s).toBeGreaterThan(70);
    });

    it('should convert HSL to hex correctly', () => {
      const hex = hslToHex(206, 78, 42);
      expect(hex.toLowerCase()).toBe('#1776bf');
    });

    it('should generate brand-derived palette preserving base brand hue with high-contrast tints and shades', () => {
      const baseHex = '#1776bf';
      const baseHsl = hexToHsl(baseHex);
      const palette = generateBrandDerivedPalette(baseHex, 6);
      expect(palette.length).toBe(6);
      expect(palette[0].toLowerCase()).toBe(baseHex);
      
      palette.forEach(color => {
        expect(/^#[0-9a-fA-F]{6}$/.test(color)).toBeTrue();
        const hsl = hexToHsl(color);
        expect(hsl.h).toBe(baseHsl.h); // Preserves exact brand hue!
      });

      // All colors should be unique tints/shades
      const uniqueColors = new Set(palette);
      expect(uniqueColors.size).toBe(6);
    });
  });
});

