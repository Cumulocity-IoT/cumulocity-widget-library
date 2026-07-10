/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { AlertService } from '@c8y/ngx-components';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

interface StateMapping {
  value: string;
  label: string;
  color: string;
  isDowntime: boolean;
}

@Component({
  selector: 'lib-downtime-gantt-widget-config',
  standalone: false,
  template: `
    <!-- Input Source Selection -->
    <div class="form-group">
      <label class="control-label" translate>Input Data Source</label>
      <div style="display: flex; gap: 24px;" class="p-t-4">
        <label class="c8y-radio">
          <input 
            type="radio" 
            name="inputType" 
            value="measurement" 
            [(ngModel)]="config.inputType" 
            (change)="onInputTypeChange()"
          />
          <span></span> Measurement
        </label>
        <label class="c8y-radio">
          <input 
            type="radio" 
            name="inputType" 
            value="event" 
            [(ngModel)]="config.inputType" 
            (change)="onInputTypeChange()"
          />
          <span></span> Event
        </label>
      </div>
    </div>

    <!-- Measurement Parameters: Datapoint Selector -->
    @if (config.inputType === 'measurement') {
      <div class="form-group border-top p-t-16">
        <label class="control-label" translate>Measurement & Asset Selection</label>
        @if (datapointSelectorComponentClass) {
          <ng-container *ngComponentOutlet="datapointSelectorComponentClass; inputs: { config: config, minActiveCount: 1, maxActiveCount: 1, controlName: 'datapoints', removeTitle: true }"></ng-container>
        }
      </div>
    }

    <!-- Event Parameters: Asset & Event Inputs -->
    @if (config.inputType === 'event') {
      <div class="form-group border-top p-t-16">
        <label class="control-label" translate>Target Device / Asset</label>
        <div style="display: flex; gap: 8px; align-items: center;">
          @if (config.device) {
            <div class="input-group" style="flex: 1;">
              <span class="input-group-addon"><i c8yIcon="hdd-o"></i></span>
              <input 
                type="text" 
                class="form-control" 
                [value]="config.device.name + ' (ID: ' + config.device.id + ')'" 
                readonly 
              />
            </div>
            <button 
              type="button" 
              class="btn btn-default" 
              (click)="openModal(deviceModal)"
              title="Change device"
            >
              Change
            </button>
          } @else {
            <p class="text-warning text-small" style="margin: 0; flex: 1;">
              <i c8yIcon="warning"></i> No device selected. Please select a target device.
            </p>
            <button 
              type="button" 
              class="btn btn-primary btn-sm" 
              (click)="openModal(deviceModal)"
            >
              Select Device
            </button>
          }
        </div>
      </div>

      <div class="row">
        <div class="col-sm-6">
          <div class="form-group">
            <label class="control-label" translate>Event Type</label>
            <input 
              type="text" 
              class="form-control" 
              placeholder="e.g. c8y_MachineStateEvent" 
              [(ngModel)]="config.eventType" 
              required
            />
          </div>
        </div>
        <div class="col-sm-6">
          <div class="form-group">
            <label class="control-label" translate>State Property Path</label>
            <input 
              type="text" 
              class="form-control" 
              placeholder="e.g. status or state" 
              [(ngModel)]="config.eventStateProperty" 
              required
            />
            <p class="help-block text-muted text-xsmall m-t-4">
              Dotted paths are supported (e.g. c8y_MachineStatus.state).
            </p>
          </div>
        </div>
      </div>
    }

    <!-- State Value Mappings -->
    <div class="m-t-24 border-top p-t-16">
      <label class="control-label" style="font-size: 14px; font-weight: 600;" translate>State Mappings</label>
      <p class="text-muted text-xsmall m-b-12">
        Map incoming state values to labels and colors. Identify which states represent machine downtime.
      </p>

      <!-- Mapping Editor Table -->
      <table class="table table-condensed table-hover c8y-table m-b-12">
        <thead>
          <tr>
            <th>Value</th>
            <th>Label</th>
            <th style="width: 75px; text-align: center;">Color</th>
            <th style="width: 100px; text-align: center;">Is Downtime</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody>
          @for (mapping of config.stateMappings; track mapping.value; let idx = $index) {
            <tr>
              <td>
                <input 
                  type="text" 
                  class="form-control input-sm" 
                  [(ngModel)]="mapping.value" 
                  placeholder="Raw value"
                />
              </td>
              <td>
                <input 
                  type="text" 
                  class="form-control input-sm" 
                  [(ngModel)]="mapping.label" 
                  placeholder="Display Label"
                />
              </td>
              <td style="text-align: center;">
                <input 
                  type="color" 
                  style="width: 32px; height: 26px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; background: transparent; vertical-align: middle;"
                  [(ngModel)]="mapping.color"
                />
              </td>
              <td style="text-align: center; vertical-align: middle;">
                <label class="c8y-checkbox" style="margin: 0; padding: 0; display: inline-block;">
                  <input 
                    type="checkbox" 
                    [(ngModel)]="mapping.isDowntime" 
                  />
                  <span></span>
                </label>
              </td>
              <td style="vertical-align: middle; text-align: center;">
                <button 
                  type="button" 
                  class="btn btn-xs btn-clean text-danger" 
                  (click)="removeMapping(idx)"
                  title="Remove mapping"
                >
                  <i c8yIcon="trash-o"></i>
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <!-- Add Mapping Row -->
      <div style="display: flex; gap: 8px; align-items: flex-end; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px dashed #cbd5e1;">
        <div style="flex: 2;">
          <label class="text-xsmall text-muted" style="margin-bottom: 2px;">Value</label>
          <input 
            type="text" 
            class="form-control input-sm" 
            placeholder="e.g. 0 or stopped"
            [(ngModel)]="newMapping.value"
          />
        </div>
        <div style="flex: 2;">
          <label class="text-xsmall text-muted" style="margin-bottom: 2px;">Label</label>
          <input 
            type="text" 
            class="form-control input-sm" 
            placeholder="e.g. Stopped"
            [(ngModel)]="newMapping.label"
          />
        </div>
        <div style="width: 50px; text-align: center;">
          <label class="text-xsmall text-muted" style="margin-bottom: 2px;">Color</label>
          <input 
            type="color" 
            style="width: 100%; height: 30px; padding: 0; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; background: transparent;"
            [(ngModel)]="newMapping.color"
          />
        </div>
        <div style="width: 80px; text-align: center;">
          <label class="text-xsmall text-muted" style="margin-bottom: 2px;">Downtime</label>
          <div style="height: 30px; display: flex; align-items: center; justify-content: center;">
            <label class="c8y-checkbox" style="margin: 0; padding: 0; display: inline-block;">
              <input 
                type="checkbox" 
                [(ngModel)]="newMapping.isDowntime" 
              />
              <span></span>
            </label>
          </div>
        </div>
        <div>
          <button 
            type="button" 
            class="btn btn-default btn-sm" 
            (click)="addMapping()"
            [disabled]="!newMapping.value || !newMapping.label"
          >
            <i c8yIcon="plus"></i> Add
          </button>
        </div>
      </div>
    </div>

    <!-- Display Settings -->
    <div class="m-t-24 border-top p-t-16">
      <label class="control-label" translate>Display Settings</label>
      <div class="form-group">
        <label class="c8y-checkbox m-b-8" style="display: block;">
          <input 
            type="checkbox" 
            name="showStats" 
            [(ngModel)]="config.showStats" 
          />
          <span></span>
          Show summary cards (Machine Status, Availability, Uptime/Downtime)
        </label>
        <label class="c8y-checkbox" style="display: block;">
          <input 
            type="checkbox" 
            name="showLogs" 
            [(ngModel)]="config.showLogs" 
          />
          <span></span>
          Show downtime logs table
        </label>
      </div>
    </div>

    <!-- Asset Selector Modal Template -->
    <ng-template #deviceModal>
      <div class="modal-header">
        <h4 class="modal-title" translate>Select Target Device</h4>
      </div>
      <div class="modal-body" style="max-height: 450px; overflow-y: auto; min-height: 250px;">
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
          Select
        </button>
      </div>
    </ng-template>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <lib-downtime-gantt-widget [config]="config"></lib-downtime-gantt-widget>
    </ng-template>
  `
})
export class DowntimeGanttWidgetConfigComponent implements OnInit {
  @Input() config: any = {};

  tempDeviceModel: any = null;
  modalRef?: BsModalRef;
  datapointSelectorComponentClass: any = null;

  // New mapping temporary fields
  newMapping: StateMapping = {
    value: '',
    label: '',
    color: '#34495e',
    isDowntime: false
  };

  private widgetConfigService = inject(WidgetConfigService);
  private alertService = inject(AlertService);
  private modalService = inject(BsModalService);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    // Load datapoint selector class dynamically to prevent Module Federation build and routing issues
    import('@c8y/ngx-components/datapoint-selector').then(({ WidgetDatapointsSelectorComponent }) => {
      this.datapointSelectorComponentClass = WidgetDatapointsSelectorComponent;
    });

    // Set default configuration properties if not already set
    if (!this.config.inputType) {
      this.config.inputType = 'measurement';
    }

    if (!this.config.eventType) {
      this.config.eventType = 'c8y_MachineStateEvent';
    }
    if (!this.config.eventStateProperty) {
      this.config.eventStateProperty = 'status';
    }

    if (this.config.showLogs === undefined) {
      this.config.showLogs = false;
    }

    if (this.config.showStats === undefined) {
      this.config.showStats = true;
    }

    if (!this.config.stateMappings) {
      this.setDefaultMappings();
    }

    // Register save callback
    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      if (this.config.inputType === 'measurement') {
        if (!this.config.datapoints || this.config.datapoints.length === 0) {
          this.alertService.warning('Please select a measurement data point.');
          return false;
        }
        
        // Dynamically synchronize the main device object using the datapoint target!
        const selectedDp = this.config.datapoints[0];
        if (selectedDp && selectedDp.__target) {
          this.config.device = {
            id: selectedDp.__target.id,
            name: selectedDp.__target.name
          };
        }
      } else {
        if (!this.config.device || !this.config.device.id) {
          this.alertService.warning('Please select a target device.');
          return false;
        }
        if (!this.config.eventType || !this.config.eventStateProperty) {
          this.alertService.warning('Please enter event type and property path.');
          return false;
        }
        
        // Clean up legacy datapoints from measurement mode
        this.config.datapoints = [];
      }

      if (!this.config.stateMappings || this.config.stateMappings.length === 0) {
        this.alertService.warning('Please configure at least one state mapping.');
        return false;
      }

      // Sync settings
      Object.assign(currentConfig, this.config);
      return true;
    });
  }

  setDefaultMappings() {
    if (this.config.inputType === 'measurement') {
      this.config.stateMappings = [
        { value: '0', label: 'Stopped', color: '#e74c3c', isDowntime: true },
        { value: '1', label: 'Running', color: '#2ecc71', isDowntime: false },
        { value: '2', label: 'Idle', color: '#f39c12', isDowntime: false }
      ];
    } else {
      this.config.stateMappings = [
        { value: 'stopped', label: 'Stopped', color: '#e74c3c', isDowntime: true },
        { value: 'running', label: 'Running', color: '#2ecc71', isDowntime: false },
        { value: 'idle', label: 'Idle', color: '#f39c12', isDowntime: false }
      ];
    }
  }

  onInputTypeChange() {
    this.setDefaultMappings();
  }

  addMapping() {
    if (!this.newMapping.value || !this.newMapping.label) {
      return;
    }

    // Check for duplicates
    if (this.config.stateMappings.some((m: any) => m.value.toString().trim().toLowerCase() === this.newMapping.value.toString().trim().toLowerCase())) {
      this.alertService.warning(`Mapping for value "${this.newMapping.value}" already exists.`);
      return;
    }

    this.config.stateMappings.push({
      value: this.newMapping.value.trim(),
      label: this.newMapping.label.trim(),
      color: this.newMapping.color,
      isDowntime: this.newMapping.isDowntime
    });

    // Reset fields
    this.newMapping = {
      value: '',
      label: '',
      color: '#34495e',
      isDowntime: false
    };
  }

  removeMapping(index: number) {
    this.config.stateMappings.splice(index, 1);
  }

  openModal(template: TemplateRef<any>) {
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
      this.alertService.warning('Could not resolve selected asset ID.');
      return;
    }

    this.config.device = { id, name };
    this.closeModal();
  }
}
