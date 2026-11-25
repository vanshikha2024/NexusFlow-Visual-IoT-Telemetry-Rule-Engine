# NexusFlow Backend API & Stream Processing Engine

**Project:** NexusFlow – Visual IoT Telemetry Rule Engine  
**Service:** Node.js / Express / RxJS Backend Core  
**Author / Backend Lead:** Ankit Singh (`teamleader2`)  
**Version:** 0.1.0  
**Phase:** Weeks 1–2 (Days 1–10) Review & Integration  

---

## 1. Architectural Overview

NexusFlow is a high-throughput visual IoT telemetry rule engine. The backend compiles visual workflow graphs (designed via React Flow on the frontend) into executable, reactive RxJS Observable data pipelines that process streaming sensor metrics in real time.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React Flow)                            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST (JSON Graph Schema)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESS HTTP API LAYER                             │
│   ├── /api/telemetry (Single & Bulk Ingestion, Partial Failure Resilience)  │
│   ├── /api/workflows (Workflow CRUD, Layout Preservation, Versioning)       │
│   ├── /api/workflows/validate (Static AST Validation & Cycle Detection)    │
│   └── /api/workflows/resolve (Topological Sorting & Execution Planning)    │
└──────────────────┬──────────────────────────────────┬───────────────────────┘
                   │                                  │
                   ▼                                  ▼
┌──────────────────────────────────┐ ┌────────────────────────────────────────┐
│     MONGODB INTEGRATION LAYER    │ │        RxJS LOGIC COMPILER CORE        │
│  (Rishi's Time-Series Schema)    │ │   ├── 1. Graph Parser (AST Extractor)  │
│  ├── telemetry (Bucket metrics)  │ │   ├── 2. Graph Validator (DAG cycles)  │
│  ├── workflows (Graph JSON AST)  │ │   ├── 3. Dependency Resolver (Kahn)    │
│  └── TelemetryRepository         │ │   └── 4. Stream Compiler & Handlers:   │
│      (Event-loop yield chunks)   │ │       ├── Data Source (Subject/from)   │
└──────────────────────────────────┘ │       ├── Moving Average (Sliding Win) │
                                     │       ├── Threshold Filter (Zero-eval) │
                                     │       └── Mock SMS Sink (Safe alerts)  │
                                     └────────────────────────────────────────┘
```

### Architectural Principles:
1. **Separation of Concerns**: Workflows (MongoDB document collection) and telemetry data (MongoDB Time-Series collection) are isolated.
2. **Zero `eval()` Policy**: All operators, threshold comparisons, and mathematical transforms are purely declarative without arbitrary JavaScript evaluation.
3. **Reactive Stream Processing**: Pipelines are modeled as RxJS Observables with functional sliding windows and multicast subscriptions.
4. **Safe Ingestion & Non-blocking I/O**: High-throughput telemetry ingestion incorporates payload size limits, bulk batching, and non-blocking event-loop yields (`setImmediate`).

---

## 2. Environment Configuration

Configuration is managed via `backend/src/config/env.js`, loading from `.env` with validated fallbacks:

| Variable | Type | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | `number` | `5000` | Express HTTP server port |
| `NODE_ENV` | `string` | `development` | Runtime environment (`development`, `production`, `test`) |
| `FRONTEND_URL` | `string` | `http://localhost:5173` | Allowed CORS origin for visual canvas |
| `MONGODB_URI` | `string` | `mongodb://localhost:27017/nexusflow` | MongoDB connection URI |
| `DB_NAME` | `string` | `nexusflow` | Target MongoDB database name |
| `TELEMETRY_COLLECTION` | `string` | `telemetry` | Time-Series telemetry collection name |
| `TELEMETRY_TIME_FIELD` | `string` | `timestamp` | Time-series timestamp field (BSON Date) |
| `TELEMETRY_META_FIELD` | `string` | `metadata` | Time-series bucket metadata field |
| `MAX_BATCH_SIZE` | `number` | `500` | Maximum records allowed in a single bulk request |
| `MAX_REQUEST_SIZE` | `string` | `2mb` | Maximum body parser payload size |
| `INGESTION_CHUNK_SIZE` | `number` | `250` | Database sub-batch chunk size for event-loop safety |
| `LOG_LEVEL` | `string` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`, `silent`) |

---

## 3. Endpoints & API Reference

### 3.1 Service Health & Metadata Directory
* **`GET /api/health`**: Returns system uptime, memory metrics, and MongoDB connection state.
* **`GET /api`**: Self-documenting API directory listing all registered endpoints and documentation paths.

### 3.2 Telemetry Ingestion Endpoints
* **`POST /api/telemetry`**: Ingest a single telemetry sample.
  ```json
  {
    "sensorId": "turbine-temp-01",
    "value": 85.5,
    "unit": "°C",
    "location": "Sector 4"
  }
  ```
* **`POST /api/telemetry/bulk`**: High-throughput bulk ingestion with partial-failure isolation (`207 Multi-Status` on partial rejections).
  - Add query param `?allOrNone=true` for atomic transactional behavior.
* **`GET /api/telemetry/:sensorId`**: Retrieve telemetry history for a sensor with pagination, sorting, and time filters.
* **`GET /api/telemetry/:sensorId/latest`**: Retrieve most recent reading for a sensor.
* **`GET /api/telemetry/metrics`**: Ingested record counts, failure metrics, active sensor counts, and latency tracking.

### 3.3 Visual Workflow Persistence Endpoints
* **`POST /api/workflows`**: Save a new visual workflow graph (`nodes`, `edges`, `name`, `description`).
* **`GET /api/workflows`**: List all saved workflows with optional `?status=draft|active`.
* **`GET /api/workflows/:id`**: Retrieve full workflow JSON for canvas reconstruction.
* **`PUT /api/workflows/:id`**: Update workflow nodes/edges; automatically bumps `version` (+1) and preserves layout coordinates.
* **`DELETE /api/workflows/:id`**: Delete a workflow document.

### 3.4 Graph Validation & Dependency Resolution Endpoints
* **`POST /api/workflows/validate`**: Static compile-time AST validation of a submitted graph (detects cycles, invalid types, dangling edges, and disconnected nodes).
* **`GET /api/workflows/:id/validate`**: Validate a stored workflow from database.
* **`POST /api/workflows/resolve`**: Compiles validated nodes and edges into active adjacency lists, Kahn's topological sort, and execution stages.
* **`GET /api/workflows/:id/resolve`**: Resolve dependencies for a stored workflow.

---

## 4. RxJS Logic Compiler Programmatic Usage

The compiler converts visual workflow ASTs into reactive RxJS pipelines.

```javascript
import { executeWorkflow, compileWorkflow } from './src/compiler/index.js';

const workflow = {
  name: 'Turbine Overheat Detection Pipeline',
  nodes: [
    { id: 'src', type: 'temperatureSensor', config: { sensorId: 'turbine-01' } },
    { id: 'avg', type: 'movingAverage', config: { windowSize: 3, partialWindow: false } },
    { id: 'thresh', type: 'threshold', config: { operator: '>', threshold: 80 } },
    { id: 'sms', type: 'smsAlert', config: { recipient: '+15550199' } }
  ],
  edges: [
    { source: 'src', target: 'avg' },
    { source: 'avg', target: 'thresh' },
    { source: 'thresh', target: 'sms' }
  ]
};

// Execute sequence [70, 75, 78, 82, 85, 90]
const result = executeWorkflow(workflow, {
  sequence: [70, 75, 78, 82, 85, 90]
});

console.log('Success:', result.success);
console.log('Dispatched Alerts:', result.alerts.length); // 2 alerts
console.log('Alert 1 Average:', result.alerts[0].movingAverage); // 81.67°C
console.log('Alert 2 Average:', result.alerts[1].movingAverage); // 85.67°C
```

---

## 5. Benchmark Performance Results

Executed on AMD Ryzen 5 5500U (12 cores @ 2.1GHz), 8GB RAM, Node.js v22.18.0:

### 5.1 Throughput & Latency
| Workload Scenario | Concurrency | Total Records | Throughput (Records/sec) | Avg Latency | p95 Latency | p99 Latency |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Single Ingestion (Sequential)** | `c=1` | 200 | **384.6 req/s** | 2.44 ms | 4.20 ms | 10.64 ms |
| **Single Ingestion (Concurrent)** | `c=20` | 500 | **718.5 req/s** | 27.58 ms | 38.71 ms | 42.86 ms |
| **Bulk Ingestion (Batch=50)** | `c=5` | 1,000 | **23,938 records/s** | 10.17 ms | 15.51 ms | 15.70 ms |
| **Bulk Ingestion (Batch=250)** | `c=5` | 2,500 | **42,134 records/s** | 28.74 ms | 36.15 ms | 36.15 ms |
| **Bulk Ingestion Max (Batch=500)** | `c=4` | 5,000 | **60,000 records/s** | 30.55 ms | 43.97 ms | 43.97 ms |
| **Bulk Partial-Failure Resilience** | `c=2` | 1,000 (10% bad) | **26,024 records/s** | 6.01 ms | 9.94 ms | 9.94 ms |

### 5.2 Record Accounting & Memory Impact
* **Record Accounting**: 100% precision. 0 unaccounted records across all load scenarios.
* **Memory Stability**: RSS increased by only +1.21 MB during a 5,000-record max-batch burst, with automatic V8 garbage collection reclaim immediately following execution.

---

## 6. Testing Suite

The backend features automated tests across all 14 test suites covering controllers, repositories, validators, parser, topological resolver, and the RxJS compiler:

```bash
# Run complete test suite (152 tests)
npm test

# Run performance benchmark suite
npm run benchmark

# Run compiler unit tests
node --test tests/compiler.handlers.test.js tests/logic.compiler.test.js
```

**Test Coverage Summary:**
- **Total Tests:** 152
- **Test Suites:** 40
- **Pass Rate:** 100% (152 passing, 0 failing, 0 skipped)

---

## 7. Known Limitations & Technical Debt

1. **Live WebSockets Not Connected**: WebSocket real-time event broadcasting to visual nodes is intentionally isolated for Weeks 3–4.
2. **Mock Alert Sinks**: SMS (`smsAlert`), Webhook, and Email notification sinks are mock implementations recording into `ExecutionContext`. Production Twilio/carrier adapters belong to the alerting integration phase.
3. **Database DDL Isolation**: The backend uses an adaptive Time-Series integration contract awaiting teammate Rishi's final MongoDB collection creation scripts.
4. **Frontend Decoupling**: The backend supports the agreed visual JSON schema, but full end-to-end integration with Vanshika's React Flow canvas is scheduled for subsequent sprints.

---

## 8. Remaining Integration Work (Weeks 3 & 4)

Detailed live execution architecture and event schemas are documented in [LIVE_EXECUTION_ARCHITECTURE.md](../LIVE_EXECUTION_ARCHITECTURE.md).

### Week 3: Real-Time Stream Execution & Alert Adapters
- Integrate WebSocket gateway server (`ws`) to broadcast live telemetry from data sources to compiled RxJS pipelines.
- Wire compiled action sinks to production notification providers (Twilio for SMS, SendGrid for Email, webhook dispatchers).
- Implement historical telemetry replay harness to test rule execution against past sensor data.

### Week 4: Full System Integration & Production Hardening
- Complete bidirectional integration between Vanshika's React Flow frontend and the backend RxJS compiler.
- Visual node execution state feedback (live data indicators, active thresholds, alert banners).
- Production MongoDB cluster verification with Rishi.
- Docker containerization and deployment verification.
