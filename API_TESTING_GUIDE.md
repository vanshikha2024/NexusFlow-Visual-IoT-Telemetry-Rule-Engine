# NexusFlow Telemetry Ingestion & Reliability API Guide

This document describes the Day 4 Telemetry Ingestion REST API, including bulk batch processing, partial failure handling, size limits, operational metrics, validation rules, error handling, and testing instructions.

A ready-to-import Postman Collection is available at [`backend/postman_collection.json`](backend/postman_collection.json).

---

## 1. Endpoints Overview

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/telemetry` | Ingest a single telemetry record | `201 Created` |
| `POST` | `/api/telemetry/bulk` | Ingest multiple telemetry records with partial failure resilience | `201 Created` / `207 Multi-Status` |
| `GET` | `/api/telemetry/metrics` | Retrieve operational telemetry metrics & active sensor counts | `200 OK` |
| `GET` | `/api/telemetry/:sensorId` | Query telemetry history by sensor | `200 OK` |
| `GET` | `/api/telemetry/:sensorId/latest` | Retrieve latest telemetry record for sensor | `200 OK` / `404` |
| `POST` | `/api/workflows` | Save a new visual rule workflow graph | `201 Created` |
| `GET` | `/api/workflows` | List all saved workflows (with optional `?status=`) | `200 OK` |
| `GET` | `/api/workflows/:id` | Retrieve workflow graph for canvas reconstruction | `200 OK` / `404` |
| `PUT` | `/api/workflows/:id` | Update workflow graph (auto-increments version) | `200 OK` / `404` |
| `DELETE`| `/api/workflows/:id` | Delete workflow graph by ID | `200 OK` / `404` |
| `GET` | `/api/health` | Service health status including telemetry stats | `200 OK` |

---

## 2. Ingest Single Telemetry Record

### `POST /api/telemetry`

#### Headers:
```http
Content-Type: application/json
```

#### Request Body:
```json
{
  "sensorId": "turbine-sensor-01",
  "sensorType": "Turbine Sensor",
  "value": 1850.5,
  "unit": "RPM",
  "location": "Sector 4",
  "timestamp": "2026-11-15T06:00:00.000Z"
}
```

* `sensorId` *(string, required)*: Unique identifier of the sensor/device.
* `value` *(number, required)*: Numeric reading/telemetry value.
* `timestamp` *(string/number, optional)*: ISO 8601 string or epoch milliseconds. Defaults to current server time if omitted.
* `sensorType`, `unit`, `location` *(string, optional)*: Stored in document metadata.

#### Success Response (`201 Created`):
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Telemetry record ingested successfully",
  "data": {
    "_id": "673595b128537604f32e9871",
    "timestamp": "2026-11-15T06:00:00.000Z",
    "metadata": {
      "sensorId": "turbine-sensor-01",
      "sensorType": "Turbine Sensor",
      "location": "Sector 4"
    },
    "value": 1850.5,
    "unit": "RPM"
  }
}
```

---

## 3. Ingest Bulk Telemetry Records (Partial Failure Resilient)

### `POST /api/telemetry/bulk`

Supports both a raw JSON array or a wrapped `{ records: [...] }` object.

#### Safe Partial Failure Architecture:
* **Batch Size Limit**: Configurable via `MAX_BATCH_SIZE` (default: 500 records). Requests exceeding this limit return `413 Payload Too Large`.
* **Payload Size Limit**: Configurable via `MAX_REQUEST_SIZE` (default: 2MB).
* **Event Loop Protection**: Large batches are chunked into database sub-batches of 250 records with non-blocking event-loop yields between chunks.
* **Partial Failures**: If a batch has 95 valid records and 5 invalid records, the 95 valid records are persisted to MongoDB and HTTP `207 Multi-Status` is returned with detailed diagnostics for the 5 rejected items.
* **Atomic Mode**: Add `?allOrNone=true` or header `X-All-Or-None: true` to reject the entire batch with `400 Bad Request` if any item fails validation.

#### Request Body (Raw Array):
```json
[
  {
    "sensorId": "temp-sensor-01",
    "sensorType": "Temperature Sensor",
    "value": 85.6,
    "unit": "°C",
    "location": "Furnace Room"
  },
  {
    "sensorId": "humidity-sensor-01",
    "sensorType": "Humidity Sensor",
    "value": 62.4,
    "unit": "%",
    "location": "Storage Unit"
  },
  {
    "sensorId": "turbine-sensor-01",
    "sensorType": "Turbine Sensor",
    "value": 1920.0,
    "unit": "RPM",
    "location": "Turbine Hall"
  }
]
```

#### Full Success Response (`201 Created`):
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Bulk telemetry ingested successfully",
  "data": {
    "total": 3,
    "insertedCount": 3,
    "failedCount": 0,
    "isPartial": false,
    "insertedIds": {
      "0": "673595b128537604f32e9872",
      "1": "673595b128537604f32e9873",
      "2": "673595b128537604f32e9874"
    }
  }
}
```

#### Partial Success Response (`207 Multi-Status`):
Returned when valid records are persisted and invalid records are safely rejected:
```json
{
  "statusCode": 207,
  "success": true,
  "message": "Bulk telemetry partially ingested: 2 succeeded, 1 rejected",
  "data": {
    "total": 3,
    "insertedCount": 2,
    "failedCount": 1,
    "isPartial": true,
    "insertedIds": {
      "0": "673595b128537604f32e9872",
      "2": "673595b128537604f32e9874"
    },
    "errors": [
      {
        "index": 1,
        "sensorId": null,
        "errors": [
          {
            "field": "records[1].sensorId",
            "message": "records[1].sensorId is required and must be a non-empty string."
          }
        ]
      }
    ]
  }
}
```

---

## 4. Operational Ingestion Metrics

### `GET /api/telemetry/metrics`

Returns live telemetry counters, active sensors, rolling latencies, and database health.

```bash
curl -X GET http://localhost:5000/api/telemetry/metrics
```

#### Response (`200 OK`):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Telemetry ingestion metrics retrieved successfully",
  "data": {
    "uptimeSeconds": 360,
    "ingestion": {
      "totalIngested": 1450,
      "totalFailed": 8,
      "totalBatches": 24,
      "totalSingleRequests": 85,
      "totalRequests": 109,
      "averageLatencyMs": 4.12,
      "lastIngestedAt": "2026-11-15T06:05:00.000Z",
      "activeSensorsCount": 14
    },
    "database": {
      "status": "connected",
      "connectionErrors": 0
    }
  }
}
```

---

## 5. Query Endpoints

### `GET /api/telemetry/:sensorId`
Query telemetry history for a specific sensor.

**Query Parameters**:
* `limit` *(number, default: 100, max: 1000)*
* `skip` *(number, default: 0)*
* `startTime` *(ISO date string, optional)*: Filter records on or after this timestamp
* `endTime` *(ISO date string, optional)*: Filter records on or before this timestamp

```bash
curl -X GET "http://localhost:5000/api/telemetry/turbine-sensor-01?limit=10"
```

### `GET /api/telemetry/:sensorId/latest`
Retrieve the single newest telemetry reading for a sensor.

```bash
curl -X GET "http://localhost:5000/api/telemetry/turbine-sensor-01/latest"
```

---

## 6. Error Responses & Status Codes

All errors adhere to the standardized API response schema:

| Status Code | Scenario | Example Message |
| :--- | :--- | :--- |
| **`400 Bad Request`** | Validation failure or all batch items invalid | `"Telemetry validation failed."` |
| **`400 Bad Request`** | Malformed JSON in body | `"Malformed JSON payload in request body."` |
| **`413 Payload Too Large`** | Batch exceeds `MAX_BATCH_SIZE` (500) | `"Batch size of 501 exceeds maximum allowed limit of 500 records."` |
| **`413 Payload Too Large`** | Request payload exceeds `MAX_REQUEST_SIZE` (2MB) | `"Request payload exceeds size limit (2mb)."` |
| **`404 Not Found`** | Sensor reading not found | `"No telemetry records found for sensor 'unknown'."` |
| **`503 Service Unavailable`** | MongoDB disconnected or connection dropped | `"Database service unavailable. Please retry later."` |

#### Example 413 Payload Too Large Error:
```json
{
  "success": false,
  "statusCode": 413,
  "message": "Batch size of 501 exceeds maximum allowed limit of 500 records.",
  "errors": [
    {
      "field": "records",
      "message": "Batch contains 501 records. Maximum allowed is 500."
    }
  ]
}
```

#### Example 503 Database Unavailable Error:
```json
{
  "success": false,
  "statusCode": 503,
  "message": "Database service unavailable. Please retry later.",
  "errors": []
}
```

---

## 7. Visual Workflow API (Day 6)

The Workflow API manages the persistence, retrieval, and updating of visual rule engine graphs constructed in the frontend visual graph builder (`@xyflow/react`).

Full specification and React Flow alignment details are documented in [`WORKFLOW_CONTRACT.md`](WORKFLOW_CONTRACT.md).

### 7.1 Create Workflow (`POST /api/workflows`)

#### Request:
```bash
curl -X POST "http://localhost:5000/api/workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Turbine Overheat Alert",
    "description": "Trigger SMS when turbine temp > 85C",
    "status": "active",
    "nodes": [
      {
        "id": "node_temp_01",
        "type": "dataSource",
        "label": "Turbine Sensor",
        "position": { "x": 100, "y": 150 },
        "config": { "sensorId": "turbine-sensor-01" }
      },
      {
        "id": "node_thresh_01",
        "type": "math",
        "label": "Threshold",
        "position": { "x": 380, "y": 150 },
        "config": { "operator": ">", "threshold": 85.0 }
      },
      {
        "id": "node_sms_01",
        "type": "action",
        "label": "SMS Alert",
        "position": { "x": 660, "y": 150 },
        "config": { "recipient": "+15550199" }
      }
    ],
    "edges": [
      { "id": "e1", "source": "node_temp_01", "target": "node_thresh_01" },
      { "id": "e2", "source": "node_thresh_01", "target": "node_sms_01" }
    ]
  }'
```

#### Success Response (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Workflow created successfully",
  "data": {
    "id": "6739de1a88432a9018bcfa12",
    "name": "Turbine Overheat Alert",
    "status": "active",
    "version": 1,
    "nodes": [ ... ],
    "edges": [ ... ],
    "createdAt": "2026-11-17T09:15:38.120Z",
    "updatedAt": "2026-11-17T09:15:38.120Z"
  }
}
```

### 7.2 Retrieve Workflow Graph (`GET /api/workflows/:id`)

#### Request:
```bash
curl -X GET "http://localhost:5000/api/workflows/6739de1a88432a9018bcfa12"
```

### 7.3 Update Workflow (`PUT /api/workflows/:id`)

#### Request:
```bash
curl -X PUT "http://localhost:5000/api/workflows/6739de1a88432a9018bcfa12" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Turbine Overheat Alert (Production v2)",
    "status": "active",
    "nodes": [ ... ],
    "edges": [ ... ]
  }'
```

#### Success Response (`200 OK`):
Auto-increments `version` to `2` and updates `updatedAt`.

