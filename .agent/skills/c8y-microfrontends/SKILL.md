---
name: c8y-microfrontends
description: Guidelines for developing microfrontends, plugins, and blueprints in Cumulocity, including manifest configuration and package structure. Use when working with microfrontends.
---

## Starting the developer journey for plugins and blueprints

All developer stories start with our CLI tool. You can scaffold a new application and decide which
demo you want to use. First of all, there is no big difference between usual applications, blueprints and plugins.
They are all built, tested and deployed via the application API.
However, plugins and blueprints have some detail information in their manifest file.

The manifest file contains all options that are stored in the `c8y.application` property in the
_package.json_ file, or using the modern approach in `cumulocity.config.ts`. At build time, it is compiled to the _cumulocity.json_ file. When you upload an archive containing a _cumulocity.json_ file, its information is also accessible to the application API.

### How to Configure the Manifest to Export Developed Modules

The manifest configuration is critical for defining a plugin or blueprint and exposing its functionality to other applications.

#### Key Manifest Properties
- **`isPackage: true`**: Indicates that this application is a package/microfrontend.
- **`package: "plugin"`** (or `"blueprint"`): Specifies the type of microfrontend.
- **`exports`**: An array of objects defining what the microfrontend exposes to other applications.
  - `name`: Human-readable name.
  - `module`: The name of the exported Angular module/providers function.
  - `path`: The entry point file (e.g., `./src/app/index.ts`).
  - `description`: Description of the exported functionality.
- **`remotes`**: An object where the key is the `contextPath` (usually the package name) and the value is an array of exported module names. This must match the `module` names defined in `exports`.
- **`noAppSwitcher: true`**: Recommended (always true for plugins) to hide them from the main app switcher.

#### Example Configuration (via cumulocity.config.ts)

The recommended approach for defining the manifest and module federation configuration in newer versions of the Cumulocity Web SDK is using `cumulocity.config.ts`:

```typescript
import type { ConfigurationOptions } from '@c8y/devkit';
import { name } from './package.json';

export default {
  runTime: {
    remotes: {
      [name]: ['myPluginProviders'] // Key must match contextPath/name, value must match exported module string
    },
    package: 'plugin',
    isPackage: true,
    noAppSwitcher: true,
    exports: [
      {
        name: 'My Plugin Widget',
        module: 'myPluginProviders',
        path: './src/app/index.ts',
        description: 'Adds a custom widget to the shell application'
      }
    ]
  },
  buildTime: {
    federation: [
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@c8y/client',
      '@c8y/ngx-components',
      '@ngx-translate/core'
    ]
  }
} as const satisfies ConfigurationOptions;
```

#### Example Manifest (package.json / cumulocity.json)

If you are using the older `package.json` approach, it looks like this:

```json
{
  "c8y": {
    "application": {
      "isPackage": true,
      "package": "plugin",
      "exports": [
        {
          "name": "My Plugin Widget",
          "module": "myPluginProviders",
          "path": "./src/app/index.ts",
          "description": "Adds a custom widget to the shell application"
        }
      ],
      "remotes": {
        "my-plugin-context-path": ["myPluginProviders"]
      },
      "noAppSwitcher": true
    }
  }
}
```

## Packages and their content

Packages allow you to bundle multiple plugins and/or a blueprint into one versioned unit. An optimal
package contains:

- one or more plugins and/or a blueprint
- a `README.md` file explaining the content
- a `LICENSE` file which contains details about the license used

## Extending existing applications with a plugin

You can use any of our `HOOK_*` interfaces as defined in the `ngx-components` library. 

> ### Note
> Since version 10.17.0, typed helpers like `hookWidget()`, `hookNavigator()`, and `hookRoute()` are available and highly recommended.

## Debugging Microfrontends

- **Lazy loading (Recommended)**: Configure `remotes` in `cumulocity.config.ts` and run `npm start`. This tests the local environment exactly as the Module Federation container would load it.
- **Shell**: Run `ng serve --shell cockpit` to test the plugin inside a real application container locally.

## Styling and Assets

- **Assets:** Import assets directly in TypeScript files. The bundler automatically handles the versioned path (e.g., `import myLogo from '../assets/logo.png';`).
- **Styling:** Global styles for plugins **must** be imported directly in TypeScript (e.g., `import '../assets/example.css'`) to be correctly included in the Module Federation bundle.
