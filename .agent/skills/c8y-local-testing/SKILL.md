---
name: Cumulocity Local Hybrid Testing
description: Setup the local testing environment for Cumulocity applications to test UI and microservices.
---

## Context & Purpose
This skill enables efficient UI and integration testing of Cumulocity IoT applications using Antigravity. It manages the hybrid environment where the UI runs locally, the backend is a live cloud tenant, and specific microservices run on the local machine.

## 1. Authentication Bypass
To bypass the manual Login Screen, the AI should use environment variables to handle credentials.

* **Variables:** `C8Y_BASE_URL`, `C8Y_TENANT`, `C8Y_USER`, `C8Y_PASSWORD`, `C8Y_BASE64_AUTH`.
* **Action:** If a login form is detected, the AI must automatically populate it using these variables.
* **Alternative:** Inject the `Authorization: Basic {{C8Y_BASE64_AUTH}}` header into initial requests to establish a session cookie and bypass the UI flow.

## 2. Hybrid Traffic Routing & Dev Server Modes
The environment splits traffic between the cloud and the local dev machine, depending on whether a local microservice is present or not.

### A. When a Microservice is Present
| Target | Destination | Pattern |
| :--- | :--- | :--- |
| **Local Microservice** | `http://localhost:port` | `/service/{{MICROSERVICE_NAME}}/**` |
| **Cloud Tenant** | `{{C8Y_BASE_URL}}` | everything else, including calls to other `/service/{{other-microservice}}/**` |

#### Proxy Configuration (`proxy.conf.json`) with Microservice:
```json
{
  "/service/{{MICROSERVICE_NAME}}/**": {
    "target": "http://localhost:{{LOCAL_PORT}}",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": {
      "^/service/{{MICROSERVICE_NAME}}": ""
    },
    "logLevel": "debug"
  },
  "/**": {
    "target": "{{C8Y_BASE_URL}}",
    "secure": true,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

### B. When NO Microservice is Present
If the project only contains UI components (e.g., custom widgets, application plugins) and no local microservices, the setup is simpler. You do not need to launch or configure a local microservice proxy block.

#### Proxy Configuration (`proxy.conf.json`) without Microservice:
```json
{
  "/**": {
    "target": "{{C8Y_BASE_URL}}",
    "secure": true,
    "changeOrigin": true,
    "logLevel": "debug"
  }
}
```

> [!WARNING]
> Because the target cloud tenant URL (`{{C8Y_BASE_URL}}`) is **hardcoded** in the catch-all block of `proxy.conf.json`, you **MUST** verify and update this file whenever the target environment URL or tenant changes. Failing to do so will result in routing conflicts or 401/404 errors.

**Antigravity Instructions:**
* Ensure the local Webpack/Angular proxy (`proxy.conf.json`) is correctly generated.
* Always check if `proxy.conf.json` exists in the UI project root, and ensure `"proxyConfig": "proxy.conf.json"` is added under the `serve` options in `angular.json` (or passed as `--proxy-config proxy.conf.json`).
* If an API call to a microservice fails with a 404 or 502, check if the local service is actually running and listening on the designated local port before troubleshooting the UI.

---

## 3. UI Application vs. Plugin Packages
Cumulocity frontend projects can be standalone web applications or **plugin packages** meant to be loaded into a parent application (the shell).

### Standard Web Applications
Run the standard start script:
```bash
npm start
```

### Plugin Packages
Plugins must be injected into a target host application (the shell) to be run and tested.
* **Command:** Run `npm start` with the `--shell` parameter pointing to the target Cumulocity application:
  ```bash
  npm start -- --shell <cumulocity-app-to-load-plugins-in>
  ```
  *(e.g., `npm start -- --shell cockpit` or `npm start -- --shell devicemanagement`)*

### URL & Shell Resolution Guardrails
> [!IMPORTANT]
> The target tenant URL (`C8Y_BASE_URL`) is ALWAYS required.
> If the target URL is not clear, OR if you are testing a plugin package and it is not clear which shell application should host the plugin, **you MUST stop and ask the user** to clarify the URL and/or target shell before starting the development environment.

---

## 4. Data Management on Live Tenants
Since the backend is a real cloud tenant, data created is persistent.

### Naming & Tagging
* **Mandatory Prefix:** All objects created (Managed Objects, Devices, etc.) must start with `AG_TEST_`.

### Cleanup Logic
* **Transient Mode:** After the test, the AI must query for all objects with the `AG_TEST_` prefix created in the last hour and issue `DELETE` requests.
* **Persistent Mode:** If the test fails, do NOT delete the data. Instead, output the `ID` and a direct link to the object in the Cumulocity Device Management/Cockpit UI for manual inspection.

---

## 5. Execution Guardrails
* **Tenant Awareness:** Always check the current `C8Y_TENANT` variable to ensure you are not running tests against a Production environment.
* **Rate Limiting:** Be mindful of API rate limits on the cloud tenant; avoid tight loops that create thousands of measurements in seconds.
* **XSRF:** On `POST/PUT/DELETE` requests, ensure the `X-XSRF-TOKEN` is extracted from the cookies and sent in the header if the platform session requires it.