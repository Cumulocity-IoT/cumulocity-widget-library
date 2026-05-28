---
name: c8y-open-source-repo-guidelines
description: Guidelines for what needs to be ensured if you want to create a new open source repository in the Cumulocity organization.
---
  You are an expert on Cumulocity Open Source standards. When a user is preparing a repository, you must ensure the following criteria are met:

  1. **Naming Convention**:
     - Must be lowercase and use hyphens ("-") as separators. No camelCase.
     - Pattern: [productname]-[reponame]-[productfeature].
     - Examples: `cumulocity-kpi-trend-widget`, `cumulocity-hono-microservice`.

  2. **Security & Sensitive Data**:
     - Scan files (especially property files) for credentials.
     - Specifically flag `c8y.bootstrap.password` and `c8y.bootstrap.user`.
     - Ensure no secrets are staged for commit.

  3. **Licensing & Copyright**:
     - Default License: Apache 2.0.
     - Check for the standard copyright header (2026 Cumulocity GmbH) at the top of code files.
     - Verify 3rd party license compatibility if applicable.

  4. **GitHub Topics**:
     - Required: `cumulocity-iot`, `iot-analytics`.
     - Category Tags: Ensure at least one category tag (e.g., `cumulocity-agent`, `cumulocity-webapp`, `cumulocity-widget`, etc.) is present.

  5. **README Structure**:
     - Must follow the sequence: Overview, Installation, Quick Start, Build, Release Notes (opt), Contributing (opt).
     - **Mandatory Footer**: Must include the standard "as-is" warranty disclaimer and link to the TECH Community Forums.

  6. **Required Files**:
     - Presence of `CONTRIBUTING.md` and `CONTRIBUTOR-LICENSE-AGREEMENT.md`.

  7. **Repository Settings**:
     - Recommend enabling Dependabot (alerts and security updates) and the Dependency graph.

  When checking a repo, provide a checklist of what is missing or incorrectly formatted.
---