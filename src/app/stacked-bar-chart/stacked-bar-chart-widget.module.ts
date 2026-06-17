/*
 * Copyright (c) 2026 Cumulocity GmbH.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule, HOOK_COMPONENTS } from '@c8y/ngx-components';
import { StackedBarChartWidgetComponent } from './stacked-bar-chart-widget.component';
import { StackedBarChartWidgetConfigComponent } from './stacked-bar-chart-widget-config.component';
import { STACKED_BAR_CHART_PREVIEW } from './preview-image';
import { FormsModule } from '@angular/forms';
import { DatapointSelectorModule } from '@c8y/ngx-components/datapoint-selector';
import { DateTimePickerModule } from '@c8y/ngx-components';
import { hookWidgetConfig } from '@c8y/ngx-components/context-dashboard';
import { PRESET_NAME, GlobalContextConnectorComponent, LocalControlsComponent } from '@c8y/ngx-components/global-context';
import { ChartsComponent } from '@c8y/ngx-components/echart';

@NgModule({
    imports: [
        CommonModule,
        CoreModule,
        FormsModule,
        DatapointSelectorModule,
        DateTimePickerModule,
        GlobalContextConnectorComponent,
        LocalControlsComponent,
        ChartsComponent
    ],
    declarations: [StackedBarChartWidgetComponent, StackedBarChartWidgetConfigComponent],
    providers: [
        {
            provide: HOOK_COMPONENTS,
            multi: true,
            useValue: {
                id: 'stacked-bar-chart-widget',
                label: 'Stacked Bar Chart',
                description: 'Displays a stacked bar chart with selected data points',
                previewImage: STACKED_BAR_CHART_PREVIEW,
                component: StackedBarChartWidgetComponent,
                configComponent: StackedBarChartWidgetConfigComponent,
                data: {
                    controls: PRESET_NAME.DEFAULT,
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
        },
        hookWidgetConfig({
            widgetId: 'stacked-bar-chart-widget',
            priority: 10,
            label: 'Time context',
            initialState: {
                controls: PRESET_NAME.DEFAULT
            },
            loadComponent: () =>
                import('@c8y/ngx-components/context-dashboard').then(m => m.GlobalContextSectionComponent)
        }),
        hookWidgetConfig({
            widgetId: 'stacked-bar-chart-widget',
            priority: 20,
            label: 'Data point selection',
            initialState: {
                minActiveCount: 1,
                controlName: 'datapoints'
            },
            expanded: true,
            loadComponent: () =>
                import('@c8y/ngx-components/datapoint-selector').then(
                    m => m.WidgetDatapointsSelectorComponent
                )
        })
    ]
})
export class StackedBarChartWidgetModule { }
