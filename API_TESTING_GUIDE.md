# NexusFlow Telemetry Ingestion API Guide

This document describes the Day 3 Telemetry Ingestion REST API endpoints, payload formats, validation rules, error handling, and testing instructions.

A ready-to-import Postman Collection is available at [`backend/postman_collection.json`](backend/postman_collection.json).

---

## 1. Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/telemetry` | Ingest a single telemetry record |
| `POST` | `/api/telemetry/bulk` | Ingest multiple telemetry records in batch |
| `GET` | `/api/telemetry/:sensorId` | Query telemetry history by sensor |
| `GET` | `/api/telemetry/:sensorId/latest` | Retrieve latest telemetry record for sensor |
| `GET` | `/api/health` | Service health status |

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
  "timestamp": "2026-11-14T06:00:00.000Z"
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
    "timestamp": "2026-11-14T06:00:00.000Z",
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

#### cURL Example:
```bash
curl -X POST http://localhost:5000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "sensorId": "turbine-sensor-01",
    "sensorType": "Turbine Sensor",
    "value": 1850.5,
    "unit": "RPM",
    "location": "Sector 4"
  }'
```

---

## 3. Ingest Bulk Telemetry Records

### `POST /api/telemetry/bulk`

Supports both a raw JSON array or a wrapped `{ records: [...] }` object.

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

#### Request Body (Wrapped Object):
```json
{
  "records": [
    {
      "sensorId": "pressure-sensor-01",
      "value": 101.3,
      "unit": "kPa"
    },
    {
      "sensorId": "pressure-sensor-02",
      "value": 102.8,
      "unit": "kPa"
    }
  ]
}
```

#### Success Response (`201 Created`):
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Bulk telemetry ingested successfully",
  "data": {
    "insertedCount": 3,
    "insertedIds": {
      "0": "673595b128537604f32e9872",
      "1": "673595b128537604f32e9873",
      "2": "673595b128537604f32e9874"
    },
    "documents": [ ... ]
  }
}
```

#### cURL Example:
```bash
curl -X POST http://localhost:5000/api/telemetry/bulk \
  -H "Content-Type: application/json" \
  -d '[
    { "sensorId": "temp-01", "value": 85.6, "unit": "°C" },
    { "sensorId": "humidity-01", "value": 62.4, "unit": "%" }
  ]'
```

---

## 4. Query Endpoints

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

## 5. Validation and Error Responses

When a request contains invalid or missing fields, the API returns a structured `400 Bad Request` response detailing the specific error(s):

#### Missing `sensorId`:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Telemetry validation failed.",
  "errors": [
    {
      "field": "sensorId",
      "message": "sensorId is required and must be a non-empty string."
    }
  ]
}
```

#### Non-Numeric `value`:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Telemetry validation failed.",
  "errors": [
    {
      "field": "value",
      "message": "value must be a valid finite number. Received: not-a-number"
    }
  ]
}
```

#### Batch Validation Errors in Bulk:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Bulk telemetry validation failed (2 errors found across batch).",
  "errors": [
    {
      "field": "records[1].sensorId",
      "message": "records[1].sensorId is required and must be a non-empty string."
    },
    {
      "field": "records[2].value",
      "message": "records[2].value must be a valid finite number. Received: invalid"
    }
  ]
}
```

#### Database Disconnected (`503 Service Unavailable`):
```json
{
  "success": false,
  "statusCode": 503,
  "message": "Database service unavailable (current status: disconnected)."
}
```
