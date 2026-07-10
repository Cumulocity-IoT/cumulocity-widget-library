/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { AlertService } from '@c8y/ngx-components';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

interface SelectedDevice {
  id: string;
  name: string;
  color?: string;
}

@Component({
  selector: 'lib-radar-chart-widget-config',
  standalone: false,
  template: `
    <div class="form-group">
      <label class="control-label" translate>Compare Devices (Up to 5)</label>
      
      <!-- Selected Devices List (Cleaned layout with color picker) -->
      <div class="m-b-12">
        @if (selectedDevices.length === 0) {
          <p class="text-muted text-small"><i c8yIcon="info-circle"></i> No devices selected. Click "Add Device" to select one.</p>
        } @else {
          <ul class="list-group">
            @for (dev of selectedDevices; track dev.id; let idx = $index) {
              <li class="list-group-item d-flex justify-content-between align-items-center" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px;">
                <div style="display: flex; align-items: center;">
                  <!-- Color Picker input -->
                  <input 
                    type="color" 
                    style="width: 24px; height: 24px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; margin-right: 12px; cursor: pointer; background: transparent;"
                    [(ngModel)]="dev.color"
                    (change)="updateDeviceColor(idx, dev.color)"
                    title="Choose device color"
                  />
                  <div>
                    <i c8yIcon="hdd-o" class="m-r-8"></i>
                    <strong>{{ dev.name }}</strong>
                    <span class="text-muted text-small m-l-8">(ID: {{ dev.id }})</span>
                  </div>
                </div>
                <div>
                  <button 
                    type="button" 
                    class="btn btn-xs btn-clean text-danger" 
                    title="Remove device"
                    (click)="removeDevice(idx)"
                  >
                    <i c8yIcon="trash-o"></i>
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </div>

      <!-- Add Device Button -->
      @if (selectedDevices.length < 5) {
        <button 
          type="button" 
          class="btn btn-default btn-sm" 
          (click)="openModal(deviceModal)"
        >
          <i c8yIcon="plus"></i> Add Device
        </button>
      }
    </div>

    <!-- Additional Display Settings -->
    <div class="m-t-24 border-top p-t-16">
      <label class="control-label" translate>Display Settings</label>
      <div class="form-group">
        <label class="c8y-checkbox">
          <input 
            type="checkbox" 
            name="showTable" 
            [(ngModel)]="config.showTable" 
          />
          <span></span>
          Show data table under the chart
        </label>
      </div>
    </div>

    <!-- Asset Selector Modal Template -->
    <ng-template #deviceModal>
      <div class="modal-header">
        <h4 class="modal-title" translate>Select Device or Asset</h4>
      </div>
      <div class="modal-body radar-chart-asset-modal-body" style="max-height: 450px; overflow-y: auto; min-height: 250px;">
        <c8y-asset-selector
          [(ngModel)]="tempDeviceModel"
          [config]="{ groupsSelectable: true, multi: false, showUnassignedDevices: true }"
          (onSelected)="onDevicePicked($event)"
        ></c8y-asset-selector>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" (click)="closeModal()" translate>Cancel</button>
        <button 
          type="button" 
          class="btn btn-primary" 
          [disabled]="!tempDeviceModel" 
          (click)="confirmDeviceSelection()"
          translate
        >
          Add
        </button>
      </div>
    </ng-template>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <lib-radar-chart-widget [config]="config"></lib-radar-chart-widget>
    </ng-template>
  `
})
export class RadarChartWidgetConfigComponent implements OnInit {
  @Input() config: any = {};

  selectedDevices: SelectedDevice[] = [];
  tempDeviceModel: any = null;
  modalRef?: BsModalRef;

  private widgetConfigService = inject(WidgetConfigService);
  private alertService = inject(AlertService);
  private modalService = inject(BsModalService);

  private defaultColors = ['#1776bf', '#25b875', '#e67e22', '#9b59b6', '#e74c3c'];

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    // Initialize list of devices from config with default colors if missing
    if (this.config.devices && this.config.devices.length > 0) {
      this.selectedDevices = this.config.devices.map((d: any, idx: number) => ({
        ...d,
        color: d.color || this.defaultColors[idx % this.defaultColors.length]
      }));
    } else {
      this.selectedDevices = [];
    }

    // Default showTable to true if not defined
    if (this.config.showTable === undefined) {
      this.config.showTable = true;
    }

    // Force default calculation mode to latest
    this.config.valueMode = 'latest';

    // Before-save validation hook
    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      const activeDevices = this.selectedDevices.filter(d => d && d.id);

      if (activeDevices.length === 0) {
        this.alertService.warning('Please select at least one device.');
        return false;
      }

      // Auto-set the first device as primary source
      const primaryDevice = activeDevices[0];
      this.config.device = primaryDevice;

      // Sync configurations directly
      currentConfig.devices = activeDevices;
      currentConfig.device = primaryDevice;
      currentConfig.showTable = this.config.showTable;
      currentConfig.valueMode = 'latest';
      return true;
    });
  }

  openModal(template: TemplateRef<any>) {
    if (this.selectedDevices.length >= 5) {
      this.alertService.danger('You can select a maximum of 5 devices.');
      return;
    }
    this.tempDeviceModel = null;
    this.modalRef = this.modalService.show(template, { class: 'modal-md' });
  }

  closeModal() {
    this.modalRef?.hide();
    this.tempDeviceModel = null;
  }

  onDevicePicked(event: any) {
    if (event) {
      this.tempDeviceModel = event;
    }
  }

  confirmDeviceSelection() {
    if (!this.tempDeviceModel) return;

    const eventObj = this.tempDeviceModel;

    const selectedItem = eventObj.items;
    const moObj = eventObj.change?.item;

    let id = '';
    let name = '';

    if (selectedItem) {
      if (Array.isArray(selectedItem)) {
        if (selectedItem[0]) {
          id = selectedItem[0].id;
          name = selectedItem[0].name || selectedItem[0].id;
        }
      } else {
        id = selectedItem.id;
        name = selectedItem.name || selectedItem.id;
      }
    }

    if (!id && moObj) {
      id = moObj.id;
      name = moObj.name || moObj.id;
    }

    if (!id) {
      const mo = eventObj.value || eventObj;
      const targetMo = Array.isArray(mo) ? mo[0] : mo;
      if (targetMo) {
        id = targetMo.id || targetMo.managedObject?.id || targetMo.mo?.id;
        name = targetMo.name || targetMo.managedObject?.name || targetMo.mo?.name || id;
      }
    }

    if (!id) {
      this.alertService.warning('Could not resolve selected asset ID. Model data: ' + JSON.stringify(eventObj));
      return;
    }

    // Duplication Check
    if (this.selectedDevices.some(d => d.id === id)) {
      this.alertService.warning('Device is already added.');
      this.closeModal();
      return;
    }

    const newDev: SelectedDevice = {
      id: id,
      name: name,
      color: this.defaultColors[this.selectedDevices.length % this.defaultColors.length]
    };

    this.selectedDevices.push(newDev);
    this.config.devices = [...this.selectedDevices];

    // Auto-update primary source context if it was empty
    if (!this.config.device || !this.config.device.id) {
      this.config.device = newDev;
    }

    this.closeModal();
  }

  removeDevice(idx: number) {
    this.selectedDevices.splice(idx, 1);
    this.config.devices = [...this.selectedDevices];

    // Re-evaluate primary source context (first device in the remaining list)
    if (this.selectedDevices.length > 0) {
      this.config.device = this.selectedDevices[0];
    } else {
      this.config.device = null;
    }
  }

  updateDeviceColor(idx: number, color?: string) {
    if (this.selectedDevices[idx]) {
      this.selectedDevices[idx].color = color;
      this.config.devices = [...this.selectedDevices];
    }
  }
}
