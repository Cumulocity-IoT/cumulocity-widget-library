---
name: cumulocity-api-guide
description: Multi-scope expert for Cumulocity IoT. Accesses live OpenAPI specs for Core API and Digital Twin Manager (DTM).
---

# Cumulocity Multi-API Guide

## API Scopes & Sources
- **Core:** `https://cumulocity.com/api/core/dist/c8y-oas.yml` (Inventory, Alarms, Measurements, Identity)
- **DTM:** `https://cumulocity.com/api/dtm/dist/c8y-dtm-oas.yml` (Asset models, Property definitions, Hierarchies)

## Execution Logic
1. **Detect Scope:** Identify if the user is asking about Core platform features, DataHub analytics, or DTM asset modeling.
2. **Fetch & Query:** Execute `scripts/query_multi_spec.py <scope> <query>`.
3. **Response:** Provide technical details using the schema specific to that YAML. Always specify which API scope you are referencing.

## Usage Note
DTM reside under a specific microservice path:
- DTM: `/service/dtm/`