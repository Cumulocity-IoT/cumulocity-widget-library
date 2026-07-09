/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, Input, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { WidgetConfigService } from '@c8y/ngx-components/context-dashboard';

@Component({
  selector: 'lib-ideal-state-deviation-widget-config',
  standalone: false,
  template: `
    <div class="form-group">
      <label class="control-label" translate>Calculation Mode</label>
      <select 
        class="form-control" 
        [(ngModel)]="config.calculationMode" 
      >
        <option value="linear">Linear Decay</option>
        <option value="exponential">Exponential Decay</option>
        <option value="sigmoid">Sigmoidal (S-Curve)</option>
      </select>
      <p class="help-block text-muted text-xsmall m-t-4">
        Defines how the score drops from 100 to 0 as the value deviates from the ideal state.
      </p>
    </div>

    <!-- Exponent Slider (Visible only in Exponential Mode) -->
    @if (config.calculationMode === 'exponential') {
      <div class="form-group">
        <label class="control-label" translate>Exponent (p): {{ config.exponent | number:'1.1-1' }}</label>
        <input 
          type="range" 
          class="form-control" 
          min="0.5" 
          max="5.0" 
          step="0.1" 
          [(ngModel)]="config.exponent" 
        />
        <div style="display: flex; justify-content: space-between;" class="text-xsmall text-muted m-t-4">
          <span>Strict (0.5)</span>
          <span>Standard (2.0)</span>
          <span>Lenient (5.0)</span>
        </div>
      </div>
    }

    <!-- Grace Zone Slider -->
    <div class="form-group m-t-16">
      <label class="control-label" translate>Grace Zone: {{ config.graceZone | number:'1.0-0' }}%</label>
      <input 
        type="range" 
        class="form-control" 
        min="0" 
        max="20" 
        step="1" 
        [(ngModel)]="config.graceZone" 
      />
      <p class="help-block text-muted text-xsmall m-t-4">
        Size of the boundary around the ideal target (0% to 20%) that still receives a perfect 100% score.
      </p>
    </div>

    <!-- Display Settings -->
    <div class="m-t-24 border-top p-t-16">
      <label class="control-label" translate>Display Settings</label>
      <div class="form-group">
        <label class="c8y-checkbox">
          <input 
            type="checkbox" 
            name="showDetailedList" 
            [(ngModel)]="config.showDetailedList" 
          />
          <span></span>
          Show individual measurement scores
        </label>
      </div>
    </div>

    <!-- Live Preview Template -->
    <ng-template #widgetPreview>
      <lib-ideal-state-deviation-widget [config]="config"></lib-ideal-state-deviation-widget>
    </ng-template>
  `
})
export class IdealStateDeviationWidgetConfigComponent implements OnInit {
  @Input() config: any = {};

  private widgetConfigService = inject(WidgetConfigService);

  @ViewChild('widgetPreview')
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit() {
    // Set default configuration properties if not already set
    if (!this.config.calculationMode) {
      this.config.calculationMode = 'linear';
    }
    if (this.config.graceZone === undefined) {
      this.config.graceZone = 5; // Default 5% grace zone
    }
    if (this.config.exponent === undefined) {
      this.config.exponent = 2.0; // Default quadratic drop-off
    }
    if (this.config.showDetailedList === undefined) {
      this.config.showDetailedList = true;
    }

    // Register simple before-save callback
    this.widgetConfigService.addOnBeforeSave((currentConfig: any) => {
      currentConfig.calculationMode = this.config.calculationMode;
      currentConfig.graceZone = this.config.graceZone;
      currentConfig.exponent = this.config.exponent;
      currentConfig.showDetailedList = this.config.showDetailedList;
      return true;
    });
  }
}
