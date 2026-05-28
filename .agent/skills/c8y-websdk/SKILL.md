---
name: c8y-websdk
description: Best practices for developing Cumulocity web applications and components using the Web SDK and Angular. Use when starting a new UI project or creating plugins.
---

You are a web developer, developing UI plugins for Cumulocity.

A full developer guide can be found at https://cumulocity.com/codex/

The Cumulocity Web SDK uses [Angular](https://angular.io) as its main framework and the
Angular tool-set for development. You can get all Web SDK libraries via npm under the `@c8y`
scope.

**Example:**
You can add a Cumulocity application to your Angular application by running
the command `ng add @c8y/websdk`.

## Setup

Verify that Node.js and npm are correctly installed and the Angular CLI as well.
The following table shows an overview of the supported versions:

| Angular version | Web SDK version | Recommended Node.js version |
| --- | --- | --- |
| 20.x.x | 1023.x.x | Node.js 20.x or 22.x |
| 19.x.x | 1022.x.x | Node.js 18.x or 20.x |
| 18.x.x | 1021.x.x | Node.js 18.x or 20.x |
| 17.x.x | 1020.x.x | Node.js 18.x or 20.x |

## Scaffolding your application

1. Start by creating a standard Angular application:
⚠️ Important:
Server-side rendering is not supported yet, so you must disable it (--ssr=false).

> **Important Sandbox Limitation:** When generating apps or running `npm install` via the AI agent on macOS, strict sandbox (`sandbox-exec`) restrictions often cause `npm error code EPERM` (Operation not permitted) or block write/read access entirely to the `node_modules` and `.npm` cache directories.
>
> **The Solution:** The AI Agent can scaffold the files (`ng new <app> --skip-install`), but you (the user) will often need to open your own terminal and manually run:
> ```bash
> cd <app_directory>
> npm install
> ng add @c8y/websdk
> ```
> This executes the installation outside the agent's restricted sandbox.

```bash
npx --yes @angular/cli@19 new widget-plugin --interactive=false --style=less --ssr=false --skip-install
```

2. Navigate to your application's directory:

3. Wait for the initialization and npm packages installation to complete.

4. Navigate to your application's directory:

5. Add the Cumulocity Web SDK to your project:
```bash
ng add @c8y/websdk
```

6. Confirm the installation of @c8y/websdk.

7. Select a base project template depending on your goals.
- For an empty application, use application.
- To extend an existing application, use cockpit, devicemanagement, or others.

8. Select a version of the Cumulocity Web SDK to scaffold from. If no furhter instructions select the latest.

9. Wait for the installation to complete. The Cumulocity Web SDK will be added to your project, including necessary dependencies and configurations.

Info:

When using application templates of administration, cockpit, devicemanagement, and hybrid ensure that Angular always uses non-standalone mode.
