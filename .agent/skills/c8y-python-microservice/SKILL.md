---
name: c8y-python-microservice
description: Standard practices for developing, testing, and building Python microservices in the Cumulocity ecosystem. Use when creating or refactoring Python microservices.
---

# Creating Python Microservices in Cumulocity

This rule outlines the standard practices for developing, testing, and building Python microservices for Cumulocity.

## 1. Folder Structure
A standard project should follow this structure:

```text
.
├── .agent/              # AI Agent rules and workflows
├── src/                 # Application source code
├── tests/               # Test suite (pytest)
├── cumulocity.json      # Microservice manifest
├── Dockerfile           # Container definition
├── requirements.txt     # Python dependencies
├── build.sh             # Build and package script
└── run_local.sh         # Local execution script
```

## 2. Microservice Manifest (`cumulocity.json`)
The manifest defines the microservice identity and resource requirements.
- **name**: Should match the Docker image name.
- **isolation**: Typically `PER_TENANT`.
- **resources**: Define CPU and memory limits. 100m and 256Mi are good defaults.
- **apiVersion**: Must be v2
- **provider**: Name should be Cumulocity
- **requiredRoles**: Should be based on what Cumulocity APIs are used. Keep in mind that ADMIN roles do not include READ permissions if there is a specific READ role available.

## 3. Dockerfile Best Practices
Use a slim Python base image and ensure the `src` directory is copied correctly.

## 4. Authentication and Roles
In Cumulocity microservices, authentication depends on the isolation mode:
- **PER_TENANT (Standard)**: The platform automatically provides `C8Y_USER`, `C8Y_PASSWORD`, and `C8Y_TENANT` credentials. This user has all roles specified in the `requiredRoles` section of `cumulocity.json` already assigned. Microservices should prioritize these variables for API requests.
- **MULTI_TENANT**: Use `C8Y_BOOTSTRAP_USER`, `C8Y_BOOTSTRAP_PASSWORD`, and `C8Y_BOOTSTRAP_TENANT` to listen for bootstrap notifications and manage tenant-specific service users.

For local development, copy the `.env` values or export the variables:
```bash
export C8Y_BASEURL="https://tenant.cumulocity.com"
export C8Y_USER="your-user"
export C8Y_PASSWORD="your-password"
export C8Y_TENANT="t12345"
```

## 5. Building for Production (`build.sh`)
The build process must build the Docker image, export to `image.tar`, and create a `.zip` package. It also needs to increment the version in `cumulocity.json`. By default the bugfix version but there should be a way with a flag to increase to minor or major version.
