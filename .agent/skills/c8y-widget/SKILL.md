---
name: c8y-widget
description: Comprehensive guide for developing custom widgets in Cumulocity, covering prerequisites, dynamic components, and step-by-step examples. Use when building UI widgets.
---

This section covers the prerequisites for widget development, explains dynamic components, and provides a step-by-step example of building a simple widget and using it in a dashboard.

## Prerequisites

Key concepts essential for widget and dashboard development.

### Widgets

Widgets are modular components that display data and interact with other parts of the Cumulocity platform. They can present maps, images, graphs, tables, and other graphical representations of data. Widgets are useful for tracking information (such as alarms, assets, or applications), or for providing maps, quick links, and more in dashboards or reports. Multiple widgets are available in `c8y/ngx-components`, but you can also create your own custom widgets.

### Dashboards

Dashboards are the surfaces where widgets are displayed. There are two types of dashboards:

*   **Context dashboard:** Resolves its data from the current context (device or group) it is displayed on. This type is usually created by the user.
*   **Named-context dashboard:** A context dashboard with a name, created programmatically for the device as a child addition.

### hookComponent and dynamic components

The `hookComponent` function allows you to add dynamic components to the UI (such as widgets). To use this function, call `hookComponent` and provide a component object compatible with `DynamicComponentDefinition` type.

Dynamic components allow you to display already registered components. This mechanism is used internally in `ContextDashboardComponent`, but you can also use it directly in the `DashboardComponent`.

## Creating an application and adding a custom widget

The following steps describe how to create a new application with a custom widget.

### Initialize an example application

Install the Angular 19 `@angular/cli` package:

```bash
npm install @angular/cli@19 -g
```

Generate a new Angular 19 application:

```bash
ng new <appName> --interactive=false --style=less --ssr=false
```

Navigate to the application directory:

```bash
cd <appName>
```

Use the `ng add` command to include `@c8y/websdk`, and follow the prompts. For this example, select the Cockpit application when prompted to choose which application to add.

```bash
ng add @c8y/websdk
```

### Create a custom widget

In this example, the custom widget implementation consists of three elements:

#### WidgetDemo component class

Responsible for displaying a widget on the dashboard. It has one input for the `config` object, which can be stored in the database and configured by the widget config.

#### WidgetConfigDemo component class

Handles changing the configuration of an existing or new widget. You must add a `config` object, which you can fill with any serializable configuration you want to pass to the widget. To enable widget configuration validation, add the appropriate option to the `@Component` decorator.

#### DashboardWidgetDemoModule

Encapsulates the entire widget functionality and registers the widget for use in the application. The most important element of the module is the `hookComponent`. The hook method is called with an object that implements `DynamicComponentDefinition` and contains all necessary data, such as the dynamic component ID, view and config classes, and settings.

**File: demo-widget.component.ts**
```typescript
import { Component, computed, input, OnInit } from "@angular/core";
import {
  DismissAlertStrategy,
  DynamicComponentAlert,
  DynamicComponentAlertAggregator,
} from "@c8y/ngx-components";
import { WidgetConfig } from "./widget-config.model";

@Component({
  selector: "c8y-widget-demo",
  template: `
    <div class="p-16">
      <h1>Demo Widget</h1>
      <p class="text">{{ displayText() }}</p>
      @if (deviceName()) {
        <small>Device: {{ deviceName() }}</small>
      }
      <div class="m-t-16">
        <button class="btn btn-default btn-sm" (click)="showAlert()">Show alert</button>
      </div>
    </div>
  `,
  styles: [
    `
      .text {
        font-size: 1.5em;
        color: var(--c8y-brand-primary);
      }
    `,
  ],
  standalone: true,
})
export class WidgetDemo implements OnInit {
  readonly config = input<WidgetConfig>();

  /** Computed signal for display text with fallback */
  readonly displayText = computed(
    () => this.config()?.text || "No text configured",
  );

  /** Computed signal for device name */
  readonly deviceName = computed(() => this.config()?.device?.name);

  /** Set by the dashboard framework - used to display alerts on the widget */
  alerts: DynamicComponentAlertAggregator;

  ngOnInit(): void {
    // Enable dismissible alerts for warning type
    this.alerts?.setAlertGroupDismissStrategy(
      "warning",
      DismissAlertStrategy.TEMPORARY,
    );
  }

  showAlert(): void {
    this.alerts?.addAlerts(
      new DynamicComponentAlert({
        type: "warning",
        text: "This is a dismissible demo alert!",
      }),
    );
  }
}
```

**File: demo-widget-config.component.ts**
```typescript
import { AsyncPipe } from "@angular/common";
import {
  Component,
  DestroyRef,
  inject,
  Input,
  OnInit,
  TemplateRef,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  ControlContainer,
  FormBuilder,
  FormControl,
  FormGroup,
  NgForm,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  AlertService,
  DynamicComponent,
  FormGroupComponent,
} from "@c8y/ngx-components";
import { WidgetConfigService } from "@c8y/ngx-components/context-dashboard";
import { BehaviorSubject } from "rxjs";
import { WidgetDemo } from "./demo-widget.component";
import { WidgetConfig } from "./widget-config.model";

@Component({
  selector: "c8y-widget-config-demo",
  template: `
    <div class="form-group">
      <c8y-form-group>
        <label>Text</label>
        <textarea style="width: 100%" [formControl]="formGroup.controls.text"></textarea>
      </c8y-form-group>
    </div>

    <ng-template #widgetPreview>
      <c8y-widget-demo [config]="config$ | async"></c8y-widget-demo>
    </ng-template>
  `,
  viewProviders: [{ provide: ControlContainer, useExisting: NgForm }],
  standalone: true,
  imports: [FormGroupComponent, ReactiveFormsModule, WidgetDemo, AsyncPipe],
})
export class WidgetConfigDemo implements DynamicComponent, OnInit {
  /** Configuration passed by the dashboard framework. */
  @Input() config: WidgetConfig = {};

  /** Reactive form group for the widget configuration. */
  formGroup: FormGroup<{ text: FormControl<string | null> }>;

  /** Emits config changes for the preview template. */
  config$ = new BehaviorSubject<WidgetConfig>({});

  private readonly alert = inject(AlertService);
  private readonly widgetConfigService = inject(WidgetConfigService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly form = inject(NgForm);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild("widgetPreview")
  set preview(template: TemplateRef<any>) {
    this.widgetConfigService.setPreview(template ?? null);
  }

  ngOnInit(): void {
    // Create form with initial values from config
    this.formGroup = this.formBuilder.group({
      text: [this.config?.text || "", Validators.required],
    });

    // Register form with parent NgForm for validation
    this.form.form.addControl("widgetConfig", this.formGroup);

    // Initialize preview
    this.config$.next(this.config);

    // Update preview when form values change
    this.formGroup.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.config$.next({ ...this.config, ...value });
      });

    // Register save callback - validates and merges form values into config
    this.widgetConfigService.addOnBeforeSave((config) => {
      if (this.formGroup.invalid) {
        this.alert.warning("Please enter a valid text.");
        return false;
      }
      Object.assign(config, this.formGroup.value);
      return true;
    });
  }
}
```

**File: index.ts (Module definition)**
```typescript
import { DynamicComponentErrorStrategy, hookWidget } from "@c8y/ngx-components";
import { WidgetDemo } from "./demo-widget.component";
import { WidgetConfigDemo } from "./demo-widget-config.component";

export function provideDemoWidget() {
  return [
    hookWidget({
      id: "angular.widget.demo",
      label: "Demo Widget",
      description: "A simple demo widget showing text and device context",
      component: WidgetDemo,
      configComponent: WidgetConfigDemo,
      errorStrategy: DynamicComponentErrorStrategy.OVERLAY_ERROR,
      data: {
        schema: () =>
          import(
            "c8y-schema-loader?interfaceName=WidgetConfig!./widget-config.model"
          ),
        settings: {
          noNewWidgets: false,
        },
      },
    }),
  ];
}
```

Add these three elements to your application source folder and import the `provideDemoWidget()` function into your application module providers.

### Using your custom widget in the application

A widget can be used in two ways: implicitly within a context dashboard or directly as a dynamic component.

#### Using a widget in a context dashboard

In this scenario, the dynamic component is already integrated into the context dashboard. You can add your custom widget (named My angular widget or similar based on `id`/`label`) from the list of available widgets on the home or context dashboard.

**Example Context Dashboard Component:**
```typescript
import { Component } from "@angular/core";
import { CoreModule, Widget } from "@c8y/ngx-components";
import { CommonModule } from "@angular/common";
import { ContextDashboardModule } from "@c8y/ngx-components/context-dashboard";

@Component({
  selector: "tut-widget-guide-dashboard",
  template: `
    <c8y-title>Context dashboard</c8y-title>
    <c8y-context-dashboard
      name="example-widget"
      [defaultWidgets]="defaultWidgets"
      [canDelete]="false"
    ></c8y-context-dashboard>
  `,
  standalone: true,
  imports: [ContextDashboardModule, CoreModule, CommonModule],
})
export class WidgetGuideContextDashboardComponent {
  defaultWidgets: Widget[] = [
    {
      _x: 3,
      _y: 0,
      _width: 6,
      _height: 6,
      componentId: "angular.widget.demo",
      config: {
        text: "This text is configured via the widget settings. Click the edit button to change it!",
      },
      title: "Demo Widget Example1",
      id: "demo_widget_example",
    },
  ];
}
```

#### Direct usage of a dynamic component

Dynamic components can be used anywhere in the application, but are most commonly utilized as widgets within a dashboard component.

**Example Direct Usage (Standalone Component Dashboard):**
```typescript
import { Component, OnDestroy, ViewChild } from "@angular/core";
import { CoreModule } from "@c8y/ngx-components";
import { CommonModule } from "@angular/common";
import { AssetSelectorModule } from "@c8y/ngx-components/assets-navigator";
import { DatapointSelectorModule } from "@c8y/ngx-components/datapoint-selector";
import { NgForm } from "@angular/forms";
import { Subscription } from "rxjs";

@Component({
  selector: "tut-widget-guide-dashboard",
  template: `
    <c8y-title>Custom dashboard</c8y-title>
    <c8y-action-bar-item [placement]="'right'">
      <button class="btn btn-link" title="{{ 'Toggle freeze' }}" (click)="isFrozen = !isFrozen">
        <i [c8yIcon]="isFrozen ? 'lock' : 'unlock'"></i>
        {{ 'Toggle freeze' }}
      </button>
    </c8y-action-bar-item>
    <c8y-dashboard>
      <!-- Dashboard child with a dynamic component -->
      <c8y-dashboard-child [width]="10" [height]="4">
        <c8y-dashboard-child-title>
          <span>Dynamic component child title</span>
        </c8y-dashboard-child-title>
        <c8y-dashboard-child-action>
          <button
            title="{{ 'Configure this widget' }}"
            type="button"
            (click)="editComponent = !editComponent; (false)"
          >
            <i [c8yIcon]="'cog'"></i>
            {{ !editComponent ? 'Configure this widget' : 'Close configuration' }}
          </button>
        </c8y-dashboard-child-action>
        <div class="card-block">
          <form name="form" #configForm="ngForm">
            <!--            important -->
            <c8y-dynamic-component
              componentId="angular.widget.demo"
              [config]="{ text: 'Hello world' }"
              [mode]="editComponent ? 'config' : 'component'"
            ></c8y-dynamic-component>
            <!--            /important-->
          </form>
        </div>
      </c8y-dashboard-child>
    </c8y-dashboard>
  `,
  standalone: true,
  imports: [
    CommonModule,
    CoreModule,
    AssetSelectorModule,
    DatapointSelectorModule,
  ],
})
export class WidgetGuideDashboardComponent implements OnDestroy {
  isFrozen = false;
  editComponent = false;

  @ViewChild("configForm", { static: false })
  configForm!: NgForm;

  subscription!: Subscription;

  ngAfterViewInit() {
    this.subscription = this.configForm.valueChanges!.subscribe((value) =>
      console.log("Widget config:", value),
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
```
