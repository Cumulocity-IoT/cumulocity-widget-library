---
name: cumulocity-dtm-hierarchies
description: Expertise in managing complex asset hierarchies using the Cumulocity Digital Twin Manager (DTM) API.
---

# Cumulocity DTM Hierarchies

This skill covers the advanced usage of the Digital Twin Manager (DTM) API for asset management.

## 1. Property Definitions
Before using custom properties in asset definitions, they must be defined globally.

### Creation
Use `POST /service/dtm/definitions/properties`.

**Payload Example:**
```json
{
  "identifier": "Service_Contact",
  "jsonSchema": {
    "title": "Service Contact",
    "description": "Maintenance contact email",
    "type": "string",
    "maxLength": 50
  },
  "contexts": ["asset"]
}
```

### Lifecycle Management
- **Pre-requisite**: Properties must exist *before* they can be linked to Asset Definitions.
- **Cleanup**: Delete properties *last*, after all assets and definitions are removed.

## 2. Asset Definitions (Models)

### Strict Payload Structure
The DTM API is extremely strict regarding the definition payload. To avoid UI bugs, the payload should match the UI-generated structure exactly:

| Field | Description/Requirement |
| :--- | :--- |
| `identifier` | Unique string (e.g., `Wind_Turbine`) |
| `jsonSchema` | Must contain `title` and `description` |
| `icon` | Mandatory object, e.g., `{"category": "", "name": ""}` |
| `isNoneChildAssetsAllowed` | Mandatory string, e.g., `"false"` |
| `composition` | Must contain `allowedProperties: []` and `allowedSubAssets: [...]` |

### Linking Properties
Properties are added to the `composition` object. Each property is identified by its global `identifier`.

**Payload Example:**
```json
{
  "identifier": "Wind_Turbine",
  "jsonSchema": { "title": "Wind Turbine", "description": "..." },
  "composition": {
    "allowedProperties": [
      { "identifier": "Manufacturer", "minOccurs": "0", "context": "asset" },
      { "identifier": "Service_Contact", "minOccurs": "0", "context": "asset" }
    ],
    "allowedSubAssets": []
  },
  "icon": { "category": "", "name": "" },
  "isNoneChildAssetsAllowed": "false"
}
```

> [!CAUTION]
> **Separation of Concerns**: Do NOT include arbitrary data values (like `Manufacturer: "Siemens"`) in the **Asset Definition** payload. The definition only defines *which* properties are allowed via the `composition.allowedProperties` list. Actual values must only be applied to **Asset Instances**. Applying data values to definitions can cause the DTM UI to crash or exhibit erratic behavior.

### Creation and Update
- **Creation**: Use `POST /service/dtm/definitions/assets`.
- **Update (Fetch-Merge-PUT)**: 
  1. `GET /service/dtm/definitions/assets/{identifier}` to fetch the current state.
  2. Remove read-only fields (`creationTime`, `lastUpdated`, `c8y_AvailableActions`).
  3. Merge structural changes into `composition.allowedSubAssets` or `jsonSchema`.
  4. `PUT /service/dtm/definitions/assets` with the merged payload.

## 3. Asset Instances

### Upsert Methodology
Use `POST /service/dtm/assets` with the header `X-Upsert-Mode: true`.
- **Properties**: Include the property values as top-level fields in the JSON body.
- **Example**: `{"type": "Wind_Turbine", "Manufacturer": "Siemens Gamesa", "name": "Turbine #001"}`
- Provide `c8y_ExternalId` as the unique identifier.
- **Forbidden Fragments**: Do NOT include `c8y_IsDeviceGroup` or `c8y_IsAsset` in the DTM request body; these are handled internally or reserved.

## 4. Linking
- **Sub-Assets**: `POST /service/dtm/assets/{parentId}/subAssets/{instanceId}`. This links instances into the hierarchy.
- **Linked Series**: `POST /service/dtm/assets/{assetId}/linkedSeries`.
  - Content-Type: `application/json`.
  - Body: An array of `LinkedSeries` objects.
  - **Best Practice**: Include explicit metadata in the `source` object (`fragment`, `series`, `type`) to ensure validation passes.

```json
[
  {
    "fragment": "c8y_PowerMeasurement",
    "series": "power",
    "label": "Main Power",
    "source": {
      "id": "12345",
      "fragment": "c8y_PowerMeasurement",
      "series": "power",
      "type": "c8y_PowerMeasurement"
    }
  }
]
```

## 5. Visibility Tip
To ensure DTM assets are visible in the standard **Device Management** or **Inventory** views, link the physical device as a `childAsset` of the DTM instance using the standard Inventory API:
`POST /inventory/managedObjects/{dtm_id}/childAssets`
