import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'lib-stacked-bar-chart-widget-config',
  standalone: false,
  template: `
    <div class="form-group">
      <label translate>Data Limit</label>
      <input type="number" class="form-control" [(ngModel)]="config.limit" name="limit" min="1" max="2000" placeholder="50">
    </div>
    <div class="form-group">
      <c8y-datapoint-selection-list
        [min]="1"
        [defaultFormOptions]="{
          showChart: false,
          showCalibrate: false,
          showMinMax: false,
          showTarget: false
        }"
        [(ngModel)]="config.datapoints"
      ></c8y-datapoint-selection-list>
    </div>
  `,
})
export class StackedBarChartWidgetConfigComponent implements OnInit {
  @Input() config: any = {};

  ngOnInit() {
    if (!this.config.limit) {
      this.config.limit = 50;
    }
  }
}
