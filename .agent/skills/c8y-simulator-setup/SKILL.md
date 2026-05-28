---
name: cumulocity-simulator-setup
description: Instructions for setting up a robust Cumulocity device simulator with asset models and CSV-based data generation.
---

# Cumulocity Simulator Setup

This skill provides a standard pattern for creating Python-based simulators in Cumulocity.

## 1. Directory Structure
All new device simulators should follow a standardized directory structure to ensure unified build and deployment scripts work out of the box.

```
<simulator-name>/
├── Dockerfile
├── cumulocity.json
├── requirements.txt
├── src/
│   ├── main.py        # Primary entry point
│   └── cleanup.py     # Script to delete generated test data
└── data/
    ├── asset_models/  # JSON definitions for asset models
    ├── devices/       # JSON configuration for devices
    └── scenarios/     # CSV files containing simulation data
```
- **Entry Points**: The runner scripts expect `src/main.py` for operation and `src/cleanup.py` for teardown.
- **Data Loading**: Python scripts should resolve paths dynamically relative to the `data/` directory, for example: `os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")`.

## 2. Asset Model Design
Asset models should follow the `c8y_AssetDefinition` type.
Organize models in the `data/asset_models/` directory and register them in dependency order (Leaf nodes first, then Parents).

### Requirements
- **Identifier**: No whitespace, use underscores (e.g., `Apartment_Building`).
- **Composition**: Define `c8y_AllowedSubAssetDefinitions` to establish the hierarchy.

## 3. Dynamic Device Registration
Use a configuration-driven approach for devices.
- Store device details in `data/devices/*.json`.
- Use `c8y_Serial` as the unique identifier in the Identity API.
- Check for existing devices before creation to ensure idempotency.

```python
def get_device_id(serial):
    url = f"{C8Y_BASEURL}/identity/externalIds/c8y_Serial/{serial}"
    resp = requests.get(url, auth=auth)
    return resp.json()['managedObject']['id'] if resp.status_code == 200 else None
```

## 4. CSV Data Generation
Simulators should use CSV files for realistic data patterns stored in `data/scenarios/` (e.g., `weekday.csv`, `weekend.csv`).
- Use `pandas` for efficient loading.
- Loop over the `Minute` or `Timestamp` column.
- Map CSV columns to Cumulocity measurements.

## 5. Environment Configuration
Always use environment variables for credentials:
- `C8Y_BASEURL`
- `C8Y_TENANT` / `C8Y_USER` / `C8Y_PASSWORD`

## 6. Deployment
- **Dockerfile**: Use `python:3-slim`, copy `src/` and `data/` directories, install `pandas` and `requests`. Set `CMD [ "python", "-u", "./src/main.py" ]`.
- **cumulocity.json**: Include required roles like `ROLE_MEASUREMENT_ADMIN` and `ROLE_INVENTORY_ADMIN`.
