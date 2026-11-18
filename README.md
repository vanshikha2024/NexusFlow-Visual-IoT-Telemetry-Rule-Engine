# NexusFlow – Database & Node.js Backend

This backend starter is specifically for **Project 1: NexusFlow – Visual IoT Telemetry & Rule Engine** from the Infotact project document.

## Database collections / models

| Model | Purpose |
|---|---|
| User | Dashboard users and workflow ownership |
| Device | Registered IoT sensors / hardware devices |
| Telemetry | High-volume, append-only sensor measurements in a MongoDB Time-Series collection |
| Workflow | Saved React Flow nodes, edges and execution status |
| Alert | Rule-triggered warnings and alert lifecycle |
| Webhook | Outbound webhook configuration for later alert integrations |

## Time-Series design

Telemetry uses:
- `time` as the time field
- `meta` as the metadata field, containing `deviceId` and `deviceType`
- `measurements` for common numeric sensor values
- `custom` for additional sensor fields

MongoDB creates a Time-Series collection when the model is first used, provided the MongoDB deployment supports it (MongoDB 5.0+). Time-Series collections are intended for append-oriented measurements; they are not ordinary collections for frequent updates/deletes.

## Install and run

```bash
npm install
```

Copy `.env.example` to `.env`, configure `MONGODB_URI`, then:

```bash
npm run dev
```

Open `http://localhost:5000/`.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/devices` | Register a sensor/device |
| GET | `/api/devices` | List devices |
| GET | `/api/devices/:deviceId` | Get one device |
| PUT | `/api/devices/:deviceId` | Update device |
| DELETE | `/api/devices/:deviceId` | Delete device |
| POST | `/api/telemetry` | Ingest one sensor measurement |
| POST | `/api/telemetry/batch` | Ingest a batch (default max 1,000) |
| GET | `/api/telemetry/:deviceId?limit=100` | Read recent device telemetry |
| POST | `/api/workflows` | Save React Flow graph |
| GET | `/api/workflows` | List workflows |
| GET | `/api/workflows/:id` | Get workflow |
| PUT | `/api/workflows/:id` | Update graph / status |
| DELETE | `/api/workflows/:id` | Delete workflow |
| POST | `/api/alerts` | Store a rule alert |
| GET | `/api/alerts?status=open` | List/filter alerts |
| PATCH | `/api/alerts/:id/status` | Acknowledge or resolve alert |

## Example device

```json
{
  "name": "Turbine Sensor",
  "deviceId": "TURBINE-001",
  "deviceType": "temperature",
  "location": "Factory Floor A"
}
```

## Example telemetry

```json
{
  "deviceId": "TURBINE-001",
  "measurements": {
    "temperature": 86.5,
    "humidity": 42,
    "pressure": 1.8,
    "vibration": 0.4
  },
  "custom": { "rpm": 1450 }
}
```

## Example React Flow workflow document

```json
{
  "name": "Turbine temperature alert",
  "description": "Alert when temperature exceeds 80 C",
  "owner": "REPLACE_WITH_USER_OBJECT_ID",
  "nodes": [
    {
      "id": "sensor-1",
      "type": "sensor",
      "position": { "x": 100, "y": 100 },
      "data": { "deviceId": "TURBINE-001", "label": "Turbine Sensor" }
    },
    {
      "id": "filter-1",
      "type": "movingAverage",
      "position": { "x": 350, "y": 100 },
      "data": { "windowSize": 5 }
    },
    {
      "id": "alert-1",
      "type": "smsAlert",
      "position": { "x": 600, "y": 100 },
      "data": { "threshold": 80, "operator": "gt" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "sensor-1", "target": "filter-1" },
    { "id": "e2", "source": "filter-1", "target": "alert-1" }
  ]
}
```

## Important integration notes

1. The workflow model stores the graph configuration. It does **not** compile or execute the RxJS pipeline. That is a separate backend service described in the project brief.
2. The alert API stores alerts when your rule engine decides a condition has fired. The actual rule evaluator / SMS delivery is not implemented in this database starter.
3. For production, protect write APIs with authentication and authorization, validate telemetry payloads, add rate limiting, and restrict who can edit or activate workflows.
4. For high ingestion rates, batch writes and avoid returning every stored telemetry record. Tune MongoDB indexes and Time-Series granularity based on real measurement frequency and query patterns.
5. Confirm the exact MongoDB version and deployment support before using Time-Series collections.
