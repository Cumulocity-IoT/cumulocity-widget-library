import { NgModule } from '@angular/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { UpgradeModule as NgUpgradeModule } from '@angular/upgrade/static';
import { CoreModule, RouterModule } from '@c8y/ngx-components';
import {
  DashboardUpgradeModule,
  UpgradeModule,
  HybridAppModule,
  UPGRADE_ROUTES
} from '@c8y/ngx-components/upgrade';
import { SubAssetsModule } from '@c8y/ngx-components/sub-assets';
import { ReportsModule } from '@c8y/ngx-components/reports';
import { BinaryFileDownloadModule } from '@c8y/ngx-components/binary-file-download';
import { CockpitConfigModule } from '@c8y/ngx-components/cockpit-config';
import { PluginSetupStepperModule } from '@c8y/ngx-components/ecosystem/plugin-setup-stepper';
import { PendingMoRequestModule } from '@c8y/ngx-components/pending-mo-request';
import { StackedBarChartWidgetModule } from './stacked-bar-chart/stacked-bar-chart-widget.module';

@NgModule({
  imports: [
    // Upgrade module must be the first
    UpgradeModule,
    BrowserAnimationsModule,
    RouterModule.forRoot([...UPGRADE_ROUTES]),
    CoreModule.forRoot(),
    ReportsModule,
    NgUpgradeModule,
    DashboardUpgradeModule,
    BinaryFileDownloadModule,
    SubAssetsModule.config(),
    CockpitConfigModule,
    PluginSetupStepperModule,
    PendingMoRequestModule,
    StackedBarChartWidgetModule
  ]
})
export class AppModule extends HybridAppModule {
  constructor(protected override upgrade: NgUpgradeModule) {
    super();
  }
}
