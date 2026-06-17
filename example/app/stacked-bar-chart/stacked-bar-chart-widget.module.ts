import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { StackedBarChartWidgetComponent } from './stacked-bar-chart-widget.component';
import { StackedBarChartWidgetConfigComponent } from './stacked-bar-chart-widget-config.component';
import { FormsModule } from '@angular/forms';
import { DatapointSelectorModule } from '@c8y/ngx-components/datapoint-selector';
import { DateTimePickerModule } from '@c8y/ngx-components';

@NgModule({
    imports: [CommonModule, CoreModule, FormsModule, DatapointSelectorModule, DateTimePickerModule],
    declarations: [StackedBarChartWidgetComponent, StackedBarChartWidgetConfigComponent],
    providers: [
        {
            provide: HOOK_COMPONENTS,
            multi: true,
            useValue: {
                id: 'stacked-bar-chart-widget',
                label: 'Stacked Bar Chart',
                description: 'Displays a stacked bar chart with selected data points',
                component: StackedBarChartWidgetComponent,
                configComponent: StackedBarChartWidgetConfigComponent,
                data: {
                    ng1: {
                        options: {
                            noDeviceTarget: true,
                            noNewWidgets: false,
                            deviceTargetNotRequired: true,
                            groupsSelectable: true
                        }
                    }
                }
            }
        }
    ]
})
export class StackedBarChartWidgetModule { }
