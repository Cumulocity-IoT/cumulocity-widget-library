/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, computed, inject, input, OnDestroy, OnInit, signal, effect, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService, InventoryBinaryService } from '@c8y/client';
import { CoreModule } from '@c8y/ngx-components';
import { PopoverModule } from 'ngx-bootstrap/popover';

interface MapMarker {
  id: string;
  name: string;
  x: number | null; // actual value
  y: number | null; // actual value
  left: number; // percentage (0-100)
  top: number; // percentage (0-100)
  active: boolean;
  lastUpdated: string;
  iconName: string;
  markerColor: string;
  type?: string;
}

@Component({
  selector: 'c8y-custom-map-widget',
  template: `
    <div class="map-widget-container p-16">
      @if (!config()?.binaryId) {
        <div class="empty-state text-center p-24">
          <i c8yIcon="map-o" class="text-large text-muted m-b-8"></i>
          <p class="text-muted">No map image uploaded. Please configure the widget.</p>
        </div>
      } @else if (!imageUrl()) {
        <div class="empty-state text-center p-24">
          <span class="spinner m-b-8"></span>
          <p class="text-muted">Loading map image...</p>
        </div>
      } @else {
        <div class="map-viewport">
          <div class="map-wrapper">
            <img 
              [src]="imageUrl()" 
              class="map-image" 
              alt="Custom Map Floor"
              (load)="onImageLoaded()"
            />
            
            @if (imageLoaded()) {
              @for (marker of markers(); track marker.id) {
                @if (marker.left !== null && marker.top !== null) {
                  <div 
                    class="map-marker"
                    [style.left.%]="marker.left"
                    [style.top.%]="marker.top"
                    [class.inactive]="!marker.active"
                    [popover]="popTemplate"
                    [popoverContext]="{ marker: marker }"
                    popoverTitle="{{ marker.name }}"
                    placement="auto"
                    triggers="mouseenter:mouseleave"
                    container="body"
                    containerClass="map-marker-popover"
                  >
                    <!-- Icon style with premium pulse halo -->
                    <div class="marker-icon-wrapper" [style.background-color]="marker.markerColor">
                      <i [c8yIcon]="marker.iconName" class="marker-device-icon"></i>
                      <div class="marker-pulse" [style.background-color]="marker.markerColor"></div>
                    </div>

                    <ng-template #popTemplate let-marker="marker">
                      <div class="tooltip-body-content">
                        <div>Type: {{ marker?.type || 'N/A' }}</div>
                        <div>X: {{ marker?.x !== null ? marker?.x?.toFixed(2) : 'N/A' }}</div>
                        <div>Y: {{ marker?.y !== null ? marker?.y?.toFixed(2) : 'N/A' }}</div>
                        <div class="tooltip-time">Updated: {{ marker?.lastUpdated }}</div>
                      </div>
                    </ng-template>
                  </div>
                }
              }
            }
          </div>
        </div>

        <!-- Legend / Info footer -->
        <div class="map-footer m-t-12 p-8 border-rounded bg-gray-50">
          <span class="text-small text-muted font-medium">
            Devices showing: {{ markers().length }} | Mode: {{ config()?.coordMode === 'gps' ? 'GPS' : 'Custom' }} | Polling: {{ config()?.pollInterval || 30 }}s
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    .map-widget-container {
      font-family: 'Outfit', 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      height: 100%;
      box-sizing: border-box;
    }
    .map-viewport {
      flex: 1;
      position: relative;
      overflow: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #f1f5f9;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 250px;
    }
    .map-wrapper {
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .map-image {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
    .map-marker {
      position: absolute;
      transform: translate(-50%, -50%);
      cursor: pointer;
      z-index: 10;
      transition: z-index 0.1s ease;
    }
    .map-marker:hover {
      z-index: 100;
    }
    .marker-pulse {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      animation: marker-pulse-anim 1.8s infinite ease-out;
      z-index: -1;
      pointer-events: none;
      opacity: 0.4;
    }
    .map-marker.inactive .marker-pulse {
      display: none;
    }
    @keyframes marker-pulse-anim {
      0% {
        transform: scale(0.9);
        opacity: 0.8;
      }
      100% {
        transform: scale(2);
        opacity: 0;
      }
    }
    /* Icon style */
    .marker-icon-wrapper {
      width: 24px;
      height: 24px;
      background: #1776bf;
      border: 2px solid #ffffff;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      color: #ffffff;
      position: relative;
    }
    .marker-device-icon {
      font-size: 12px;
      z-index: 2;
    }
    /* Popover styles */
    .map-marker-popover {
      background: rgba(15, 23, 42, 0.95) !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 6px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
      font-family: 'Outfit', 'Inter', sans-serif !important;
      pointer-events: none !important;
    }
    .map-marker-popover .popover-header {
      background: transparent !important;
      color: #ffffff !important;
      border-bottom: 1px solid rgba(255,255,255,0.1) !important;
      font-weight: 600 !important;
      padding: 8px 12px 4px 12px !important;
      font-size: 12px !important;
    }
    .map-marker-popover .popover-body {
      color: #ffffff !important;
      padding: 4px 12px 8px 12px !important;
      font-size: 11px !important;
    }
    .map-marker-popover .tooltip-body-content {
      line-height: 1.4;
    }
    .map-marker-popover .tooltip-time {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .map-marker-popover.bs-popover-top > .arrow::after,
    .map-marker-popover.bs-popover-auto[x-placement^="top"] > .arrow::after {
      border-top-color: rgba(15, 23, 42, 0.95) !important;
    }
    .map-marker-popover.bs-popover-bottom > .arrow::after,
    .map-marker-popover.bs-popover-auto[x-placement^="bottom"] > .arrow::after {
      border-bottom-color: rgba(15, 23, 42, 0.95) !important;
    }
    .map-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .border-rounded {
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .bg-gray-50 {
      background-color: #f8fafc;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
    }
  `],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, CoreModule, PopoverModule]
})
export class CustomMapWidgetComponent implements OnInit, OnDestroy {
  readonly config = input<any>();

  imageLoaded = signal<boolean>(false);
  imageUrl = signal<string | null>(null);
  markers = signal<MapMarker[]>([]);

  private inventoryService = inject(InventoryService);
  private binaryService = inject(InventoryBinaryService);
  private pollIntervalId: any;
  private devicesList: any[] = [];
  private currentBinaryId: string | null = null;

  constructor() {
    effect(async () => {
      // Trigger whenever target device, pollInterval or binaryId changes
      const deviceId = this.config()?.device?.id;
      const pollSec = this.config()?.pollInterval;
      const binaryId = this.config()?.binaryId;
      
      this.restartPolling();
      await this.loadMapImage(binaryId);
    });
  }

  ngOnInit() {
    // Initial polling setup is handled by effect()
  }

  ngOnDestroy() {
    this.stopPolling();
    this.cleanImageUrl();
  }

  onImageLoaded() {
    this.imageLoaded.set(true);
  }

  private stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private restartPolling() {
    this.stopPolling();
    this.loadDevices();

    const intervalSec = Number(this.config()?.pollInterval || 30);
    this.pollIntervalId = setInterval(() => {
      this.loadDevices();
    }, intervalSec * 1000);
  }

  async loadDevices() {
    const parentId = this.config()?.device?.id;
    if (!parentId) {
      this.markers.set([]);
      return;
    }

    try {
      const response = await this.inventoryService.detail(parentId);
      const parentMo: any = response.data;

      let children: any[] = [];
      try {
        const childResponse = await this.inventoryService.childAssetsList(parentId, { pageSize: 100 });
        if (childResponse && childResponse.data && childResponse.data.length > 0) {
          children = childResponse.data
              .map((item: any) => item.managedObject || item)
              .filter((mo: any) => !!mo && mo.id);
        }
      } catch (e) {
        // Fallback or ignore if endpoint doesn't return list
      }

      if (children.length > 0) {
        const ids = children.map(c => c.id);
        const detailedResponse = await this.inventoryService.list({ ids: ids.join(','), pageSize: 100 });
        this.devicesList = detailedResponse.data || [];
      } else {
        this.devicesList = [parentMo];
      }

      this.updateMarkers();
    } catch (err) {
      console.error('Failed to load devices for map widget:', err);
    }
  }

  private updateMarkers() {
    const mode = this.config()?.coordMode || 'gps';
    const list: MapMarker[] = [];

    this.devicesList.forEach((device) => {
      if (!device) return;
      let xVal: number | null = null;
      let yVal: number | null = null;

      if (mode === 'gps') {
        xVal = device.c8y_Position?.lng !== undefined ? Number(device.c8y_Position.lng) : null;
        yVal = device.c8y_Position?.lat !== undefined ? Number(device.c8y_Position.lat) : null;
      } else {
        const xPath = this.config()?.xPath || 'c8y_Position.x';
        const yPath = this.config()?.yPath || 'c8y_Position.y';
        xVal = this.getValueByPath(device, xPath);
        yVal = this.getValueByPath(device, yPath);
      }

      if (xVal !== null && yVal !== null) {
        const { left, top } = this.calculatePercentages(xVal, yVal);
        
        // Resolve marker styles with overrides fallback
        let iconName = this.config()?.iconName || 'hdd-o';
        let markerColor = this.config()?.markerColor || '#1776bf';

        if (device.type && this.config()?.typeOverrides) {
          const override = this.config().typeOverrides.find(
            (o: any) => o.deviceType && o.deviceType.toLowerCase() === device.type.toLowerCase()
          );
          if (override) {
            iconName = override.iconName || iconName;
            markerColor = override.markerColor || markerColor;
          }
        }

        list.push({
          id: device.id,
          name: device.name || device.id,
          x: xVal,
          y: yVal,
          left,
          top,
          active: device.c8y_ConnectionState?.status === 'CONNECTED' || true,
          lastUpdated: new Date().toLocaleTimeString(),
          iconName,
          markerColor,
          type: device.type || 'N/A'
        });
      }
    });

    this.markers.set(list);
  }

  private calculatePercentages(x: number, y: number): { left: number; top: number } {
    const mode = this.config()?.coordMode || 'gps';
    let left = 0;
    let top = 0;

    if (mode === 'gps') {
      const lat_tl = Number(this.config()?.lat_tl || 0);
      const lng_tl = Number(this.config()?.lng_tl || 0);
      const lat_br = Number(this.config()?.lat_br || 0);
      const lng_br = Number(this.config()?.lng_br || 0);

      const widthLng = lng_br - lng_tl;
      const heightLat = lat_br - lat_tl;

      left = widthLng !== 0 ? ((x - lng_tl) / widthLng) * 100 : 50;
      top = heightLat !== 0 ? ((y - lat_tl) / heightLat) * 100 : 50;
    } else {
      const x_tl = Number(this.config()?.x_tl || 0);
      const y_tl = Number(this.config()?.y_tl || 0);
      const x_br = Number(this.config()?.x_br || 100);
      const y_br = Number(this.config()?.y_br || 100);

      const widthX = x_br - x_tl;
      const heightY = y_br - y_tl;

      left = widthX !== 0 ? ((x - x_tl) / widthX) * 100 : 50;
      top = heightY !== 0 ? ((y - y_tl) / heightY) * 100 : 50;
    }

    // Keep within boundaries (0 to 100)
    left = Math.max(0, Math.min(100, left));
    top = Math.max(0, Math.min(100, top));

    return { left, top };
  }

  private getValueByPath(obj: any, path: string): number | null {
    if (!obj || !path) return null;
    const parts = path.replace(/\[['"]?([^'"]+)['"]?\]/g, '.$1').split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    const num = Number(current);
    return isNaN(num) ? null : num;
  }

  async loadMapImage(binaryId: string) {
    if (!binaryId) {
      this.cleanImageUrl();
      this.currentBinaryId = null;
      return;
    }

    if (this.currentBinaryId === binaryId) {
      return;
    }

    this.currentBinaryId = binaryId;
    this.cleanImageUrl();

    try {
      const response = await this.binaryService.download(binaryId);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.imageUrl.set(objectUrl);
    } catch (err) {
      console.error('Failed to download map image binary:', err);
      this.cleanImageUrl();
    }
  }

  private cleanImageUrl() {
    const currentUrl = this.imageUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this.imageUrl.set(null);
    }
  }
}
