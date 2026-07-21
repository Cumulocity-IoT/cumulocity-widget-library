/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, Input, OnInit, TemplateRef, ViewChild, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlContainer,
  FormBuilder,
  FormGroup,
  FormsModule,
  NgForm,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { InventoryBinaryService, InventoryService } from '@c8y/client';
import { AlertService, CoreModule, DynamicComponent, FormGroupComponent } from '@c8y/ngx-components';
import { IconSelectorModule } from '@c8y/ngx-components/icon-selector';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';
import { BehaviorSubject } from 'rxjs';
import { CustomMapWidgetComponent } from './custom-map-widget.component';

@Component({
  selector: 'c8y-custom-map-widget-config',
  template: `
    <div [formGroup]="formGroup" class="p-16">
      
      <!-- Image Upload Section -->
      <c8y-form-group>
        <label class="control-label">Map Image</label>
        <div 
          class="image-upload-container"
          [class.drag-over]="isDragOver"
          (dragover)="onDragOver($event)"
          (dragenter)="onDragEnter($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
        >
          @if (formGroup.get('binaryId')?.value && previewImageUrl()) {
            <div class="image-preview-wrapper m-b-8">
              <img 
                [src]="previewImageUrl()" 
                class="img-thumbnail image-preview"
                alt="Map preview" 
              />
              <button 
                type="button" 
                class="btn btn-dot btn-danger delete-btn" 
                (click)="removeImage()" 
                title="Remove image"
              >
                <i c8yIcon="trash-o"></i>
              </button>
            </div>
          } @else if (formGroup.get('binaryId')?.value && !previewImageUrl()) {
            <div class="upload-dropzone">
              <span class="spinner m-b-8"></span>
              <span class="text-muted">Loading preview...</span>
            </div>
          } @else {
            <div class="upload-dropzone">
              <input 
                type="file" 
                accept="image/*" 
                (change)="onFileSelected($event)" 
                id="file-upload" 
                class="hidden-input"
                [disabled]="uploading"
              />
              <label for="file-upload" class="upload-label">
                @if (uploading) {
                  <span class="spinner m-b-8"></span>
                  <span class="text-muted">Uploading image...</span>
                } @else {
                  <i c8yIcon="upload" class="text-large text-muted m-b-8"></i>
                  <span class="text-medium">Choose an image or drag here</span>
                  <span class="text-small text-muted">Supports PNG, JPG, WebP</span>
                }
              </label>
            </div>
          }
        </div>
      </c8y-form-group>

      <!-- Coordinate Mode Selector -->
      <c8y-form-group>
        <label class="control-label">Coordinate Mode</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="coordMode">
            <option value="gps">GPS Coordinates (lat, lng)</option>
            <option value="custom">Custom Coordinates (x, y)</option>
          </select>
        </div>
      </c8y-form-group>

      <!-- Polling Interval Selector -->
      <c8y-form-group>
        <label class="control-label">Update Interval</label>
        <div class="c8y-select-wrapper">
          <select class="form-control" formControlName="pollInterval">
            <option [value]="5">5 seconds</option>
            <option [value]="10">10 seconds</option>
            <option [value]="30">30 seconds (Default)</option>
          </select>
        </div>
      </c8y-form-group>



      <!-- Icon and Color Configuration -->
      <div class="row">
        <div class="col-sm-8">
          <c8y-form-group>
            <label class="control-label">Default Marker Icon</label>
            <c8y-icon-selector-wrapper formControlName="iconName"></c8y-icon-selector-wrapper>
          </c8y-form-group>
        </div>
        <div class="col-sm-4">
          <c8y-form-group>
            <label class="control-label">Default Marker Color</label>
            <input class="form-control" type="color" formControlName="markerColor" style="height: 34px; padding: 2px; cursor: pointer;" />
          </c8y-form-group>
        </div>
      </div>

      <!-- Device Type Marker Overrides Section -->
      <div class="m-b-16 bg-gray-50 border-rounded p-12">
        <h5 class="text-medium m-b-12">Device Type Marker Overrides (Optional)</h5>
        
        <!-- Add Override Row -->
        <div class="override-input-row">
          <div style="flex: 2; margin-right: 8px;">
            <label class="control-label text-small" style="margin-bottom: 4px; display: block;">Device Type</label>
            <input class="form-control input-sm" type="text" [(ngModel)]="newOverrideType" [ngModelOptions]="{standalone: true}" placeholder="e.g. c8y_Linux" />
          </div>
          <div style="flex: 1.5; margin-right: 8px;">
            <label class="control-label text-small" style="margin-bottom: 4px; display: block;">Icon</label>
            <c8y-icon-selector-wrapper [(ngModel)]="newOverrideIcon" [ngModelOptions]="{standalone: true}"></c8y-icon-selector-wrapper>
          </div>
          <div style="width: 50px; margin-right: 8px;">
            <label class="control-label text-small" style="margin-bottom: 4px; display: block;">Color</label>
            <input class="form-control input-sm" type="color" [(ngModel)]="newOverrideColor" [ngModelOptions]="{standalone: true}" style="height: 30px; padding: 2px; cursor: pointer; width: 100%;" />
          </div>
          <div style="display: flex; align-items: flex-end; height: 30px;">
            <button type="button" class="btn btn-primary btn-sm" (click)="addTypeOverride()" title="Add override" style="margin: 0; height: 30px; width: 34px; padding: 0; display: flex; align-items: center; justify-content: center;">
              <i c8yIcon="plus"></i>
            </button>
          </div>
        </div>

        <!-- List of Overrides -->
        @if (typeOverridesList.length > 0) {
          <div class="m-t-12 border-top p-t-12" style="max-height: 200px; overflow-y: auto;">
            @for (ov of typeOverridesList; track $index) {
              <div class="override-item-card">
                <div class="override-type-text" title="{{ ov.deviceType }}">
                  {{ ov.deviceType }}
                </div>
                <div class="override-icon-text" title="{{ ov.iconName }}">
                  <i [c8yIcon]="ov.iconName" class="m-r-4"></i>
                  <span class="text-muted text-small">{{ ov.iconName }}</span>
                </div>
                <div class="override-color-badge">
                  <span class="badge" [style.background-color]="ov.markerColor">{{ ov.markerColor }}</span>
                </div>
                <div class="override-action">
                  <button type="button" class="btn btn-dot btn-danger btn-xs" (click)="removeTypeOverride($index)" title="Remove">
                    <i c8yIcon="trash-o"></i>
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Coordinate Input Groups -->
      @if (formGroup.get('coordMode')?.value === 'gps') {
        <div class="coordinates-section p-12 m-b-16 bg-gray-50 border-rounded">
          <h5 class="text-medium m-b-12">GPS Coordinate Configuration</h5>
          
          <!-- Top Left -->
          <div class="row">
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Top Left Lat</label>
                <input class="form-control" type="number" formControlName="lat_tl" placeholder="e.g. 51.5074" />
              </c8y-form-group>
            </div>
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Top Left Lng</label>
                <input class="form-control" type="number" formControlName="lng_tl" placeholder="e.g. -0.1278" />
              </c8y-form-group>
            </div>
          </div>

          <!-- Bottom Right -->
          <div class="row">
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Bottom Right Lat</label>
                <input class="form-control" type="number" formControlName="lat_br" placeholder="e.g. 51.4874" />
              </c8y-form-group>
            </div>
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Bottom Right Lng</label>
                <input class="form-control" type="number" formControlName="lng_br" placeholder="e.g. -0.1078" />
              </c8y-form-group>
            </div>
          </div>
        </div>
      } @else {
        <div class="coordinates-section p-12 m-b-16 bg-gray-50 border-rounded">
          <h5 class="text-medium m-b-12">Custom Coordinate Configuration</h5>
          
          <!-- Top Left -->
          <div class="row">
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Top Left X</label>
                <input class="form-control" type="number" formControlName="x_tl" placeholder="e.g. 0" />
              </c8y-form-group>
            </div>
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Top Left Y</label>
                <input class="form-control" type="number" formControlName="y_tl" placeholder="e.g. 0" />
              </c8y-form-group>
            </div>
          </div>

          <!-- Bottom Right -->
          <div class="row">
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Bottom Right X</label>
                <input class="form-control" type="number" formControlName="x_br" placeholder="e.g. 100" />
              </c8y-form-group>
            </div>
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Bottom Right Y</label>
                <input class="form-control" type="number" formControlName="y_br" placeholder="e.g. 100" />
              </c8y-form-group>
            </div>
          </div>

          <!-- Path mapping configured via JSONPath / Dot-notation -->
          <h5 class="text-medium m-t-16 m-b-12">Device Coordinate Mapping</h5>
          <div class="row">
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">X Coordinate Path</label>
                <input class="form-control" type="text" formControlName="xPath" placeholder="e.g. c8y_Position.x" />
              </c8y-form-group>
            </div>
            <div class="col-sm-6">
              <c8y-form-group>
                <label class="control-label">Y Coordinate Path</label>
                <input class="form-control" type="text" formControlName="yPath" placeholder="e.g. c8y_Position.y" />
              </c8y-form-group>
            </div>
          </div>
        </div>
      }

    </div>

    <!-- Live Preview -->
    <ng-template #widgetPreview>
      <c8y-custom-map-widget [config]="(config$ | async) || undefined"></c8y-custom-map-widget>
    </ng-template>
  `,
  styles: [`
    .image-upload-container {
      border: 2px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      background: #f8fafc;
      transition: all 0.2s ease;
    }
    .image-upload-container:hover,
    .image-upload-container.drag-over {
      border-color: var(--c8y-brand-primary, #1776BF);
    }
    .image-upload-container.drag-over {
      background: #eff6ff;
    }
    .image-upload-container.drag-over * {
      pointer-events: none;
    }
    .upload-dropzone {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 120px;
    }
    .hidden-input {
      display: none;
    }
    .upload-label {
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      height: 100%;
    }
    .upload-label * {
      pointer-events: none;
    }
    .image-preview-wrapper {
      position: relative;
      display: inline-block;
      max-width: 100%;
    }
    .image-preview {
      max-height: 180px;
      object-fit: contain;
    }
    .delete-btn {
      position: absolute;
      top: 8px;
      right: 8px;
    }
    .border-rounded {
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .bg-gray-50 {
      background-color: #f8fafc;
    }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(0,0,0,0.1);
      border-radius: 50%;
      border-top-color: var(--c8y-brand-primary, #1776BF);
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Overrides layout styles */
    .override-input-row {
      display: flex;
      align-items: flex-end;
      width: 100%;
      margin-bottom: 8px;
    }
    .override-item-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 12px;
      margin-bottom: 6px;
      gap: 8px;
    }
    .override-type-text {
      flex: 2;
      font-weight: 500;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .override-icon-text {
      flex: 1.5;
      font-size: 12px;
      display: flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .override-color-badge {
      width: 70px;
      display: flex;
      justify-content: center;
    }
    .override-color-badge .badge {
      color: #fff;
      font-size: 10px;
      padding: 2px 6px;
      width: 100%;
      text-align: center;
      display: block;
    }
    .override-action {
      width: 30px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
    }
    .override-action button {
      padding: 0 !important;
      width: 20px !important;
      height: 20px !important;
      min-width: 20px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      margin: 0 !important;
      border-radius: 50% !important;
    }
  `],
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [CommonModule, FormGroupComponent, ReactiveFormsModule, FormsModule, CustomMapWidgetComponent, AsyncPipe, IconSelectorModule, CoreModule]
})
export class CustomMapWidgetConfigComponent implements DynamicComponent, OnInit {
  @Input() config: any = {};

  formGroup!: FormGroup;
  config$ = new BehaviorSubject<any>(null);
  uploading = false;
  isDragOver = false;
  previewImageUrl = signal<string | null>(null);
  
  typeOverridesList: any[] = [];
  newOverrideType = '';
  newOverrideIcon = 'hdd-o';
  newOverrideColor = '#1776bf';

  private alert = inject(AlertService);
  private widgetConfigService = inject(WidgetConfigService);
  private formBuilder = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private binaryService = inject(InventoryBinaryService);
  private inventoryService = inject(InventoryService);
  private currentPreviewBinaryId: string | null = null;

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    this.typeOverridesList = this.config.typeOverrides ? JSON.parse(JSON.stringify(this.config.typeOverrides)) : [];

    this.formGroup = this.formBuilder.group({
      binaryId: [this.config.binaryId || ''],
      coordMode: [this.config.coordMode || 'gps', Validators.required],
      pollInterval: [this.config.pollInterval !== undefined ? Number(this.config.pollInterval) : 30, Validators.required],
      iconName: [this.config.iconName || 'hdd-o', Validators.required],
      markerColor: [this.config.markerColor || '#1776bf', Validators.required],
      typeOverrides: [this.typeOverridesList],
      // GPS coords
      lat_tl: [this.config.lat_tl !== undefined ? this.config.lat_tl : ''],
      lng_tl: [this.config.lng_tl !== undefined ? this.config.lng_tl : ''],
      lat_br: [this.config.lat_br !== undefined ? this.config.lat_br : ''],
      lng_br: [this.config.lng_br !== undefined ? this.config.lng_br : ''],
      // Custom coords
      x_tl: [this.config.x_tl !== undefined ? this.config.x_tl : ''],
      y_tl: [this.config.y_tl !== undefined ? this.config.y_tl : ''],
      x_br: [this.config.x_br !== undefined ? this.config.x_br : ''],
      y_br: [this.config.y_br !== undefined ? this.config.y_br : ''],
      // JSONPaths
      xPath: [this.config.xPath || 'c8y_Position.x'],
      yPath: [this.config.yPath || 'c8y_Position.y']
    });

    this.emitPreview();

    this.formGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.emitPreview();
      });

    this.formGroup.get('binaryId')?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async (binId) => {
        await this.loadPreviewImage(binId);
      });

    if (this.config.binaryId) {
      this.loadPreviewImage(this.config.binaryId);
    }

    this.destroyRef.onDestroy(() => {
      this.cleanPreviewImageUrl();
    });

    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      if (this.formGroup.invalid) {
        this.alert.warning('Please complete the widget configuration.');
        return false;
      }

      const formVal = this.formGroup.getRawValue();

      if (!formVal.binaryId) {
        this.alert.danger('Please upload a map image.');
        return false;
      }

      if (formVal.coordMode === 'gps') {
        if (formVal.lat_tl === '' || formVal.lng_tl === '' || formVal.lat_br === '' || formVal.lng_br === '') {
          this.alert.danger('All GPS coordinate boundaries (Top Left and Bottom Right) must be configured.');
          return false;
        }
      } else {
        if (formVal.x_tl === '' || formVal.y_tl === '' || formVal.x_br === '' || formVal.y_br === '') {
          this.alert.danger('All custom coordinate boundaries (Top Left and Bottom Right) must be configured.');
          return false;
        }
        if (!formVal.xPath || !formVal.yPath) {
          this.alert.danger('Coordinate paths for X and Y must be provided.');
          return false;
        }
      }

      if (currentConfig) {
        Object.assign(currentConfig, formVal);
      }
      return true;
    });
  }

  private emitPreview() {
    const rawVal = this.formGroup.getRawValue();
    const widgetConf = {
      device: this.config.device, // preserve parent device context
      ...rawVal
    };
    this.config$.next(widgetConf);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragEnter(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileUpload(files[0]);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      this.handleFileUpload(file);
    }
  }

  async handleFileUpload(file: File) {
    this.uploading = true;
    try {
      // 1. Upload binary file
      const response = await this.binaryService.create(file, {
        name: file.name,
        type: file.type
      });
      const binaryId = response.data ? response.data.id : undefined;

      // 2. Associate with dashboard (if dashboard ID and binary ID are found)
      const dashboardId = this.getDashboardId();
      if (binaryId && dashboardId) {
        await this.inventoryService.childAdditionsAdd(binaryId, dashboardId);
      }

      this.formGroup.patchValue({ binaryId });
      this.alert.success('Map image uploaded successfully.');
    } catch (err) {
      console.error('File upload failed:', err);
      this.alert.danger('Failed to upload map image.');
    } finally {
      this.uploading = false;
    }
  }

  removeImage() {
    this.formGroup.patchValue({ binaryId: '' });
  }

  private getDashboardId(): string | null {
    const url = this.router.url;
    // URL pattern /dashboard/:id or /device/:deviceId/dashboard/:id
    const match = url.match(/\/dashboard\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  }

  async loadPreviewImage(binaryId: string) {
    if (!binaryId) {
      this.cleanPreviewImageUrl();
      this.currentPreviewBinaryId = null;
      return;
    }

    if (this.currentPreviewBinaryId === binaryId) {
      return;
    }

    this.currentPreviewBinaryId = binaryId;
    this.cleanPreviewImageUrl();

    try {
      const response = await this.binaryService.download(binaryId);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      this.previewImageUrl.set(objectUrl);
    } catch (err) {
      console.error('Failed to download preview map image binary:', err);
      this.cleanPreviewImageUrl();
    }
  }

  private cleanPreviewImageUrl() {
    const currentUrl = this.previewImageUrl();
    if (currentUrl) {
      URL.revokeObjectURL(currentUrl);
      this.previewImageUrl.set(null);
    }
  }

  addTypeOverride() {
    if (!this.newOverrideType.trim()) {
      this.alert.warning('Please enter a device type.');
      return;
    }
    const exists = this.typeOverridesList.some(o => o.deviceType.toLowerCase() === this.newOverrideType.trim().toLowerCase());
    if (exists) {
      this.alert.warning(`An override for device type "${this.newOverrideType}" already exists.`);
      return;
    }
    this.typeOverridesList.push({
      deviceType: this.newOverrideType.trim(),
      iconName: this.newOverrideIcon,
      markerColor: this.newOverrideColor
    });
    this.formGroup.patchValue({ typeOverrides: [...this.typeOverridesList] });
    this.newOverrideType = '';
    this.newOverrideIcon = 'hdd-o';
    this.newOverrideColor = '#1776bf';
  }

  removeTypeOverride(index: number) {
    this.typeOverridesList.splice(index, 1);
    this.formGroup.patchValue({ typeOverrides: [...this.typeOverridesList] });
  }
}
