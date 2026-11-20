# NexusFlow Visual Workflow & Graph JSON Integration Contract

**Document Version:** 1.0.0  
**Date:** November 17, 2026  
**Authors:** Ankit Singh (Backend Lead), aligned with Vanshika (Frontend Lead, React Flow)  
**Status:** Implemented & Verified in `teamleader2` branch  

---

## 1. Overview & Architectural Isolation

The NexusFlow Visual Workflow API manages the persistence, retrieval, and updating of rule engine graphs constructed in the frontend visual graph builder (`@xyflow/react`).

### Critical Architectural Boundary:
* **Workflow Graphs**: Persisted in the dedicated **`workflows`** MongoDB collection via standard document modeling.
* **Telemetry Data**: Ingested and stored strictly in the **`telemetry`** Time-Series collection managed in coordination with Rishi.
* **No Shared Collections**: Workflows and telemetry streams remain completely decoupled.

---

## 2. Graph JSON Schema Alignment (React Flow)

Based on inspection of Vanshika's React Flow visual canvas (`@xyflow/react`) and frontend node palette (`NODE_LIBRARY` in `frontend/src/nodeTypes.js`), the backend contract supports both category-based component types and fine-grained domain identifiers.

### 2.1 Supported Node Types & Categories

Because frontend node definitions are continuously evolving, the backend validator **does not hardcode or restrict node type identifiers**. Any non-empty string identifier is accepted.

| Category (Frontend Palette) | UI Color | Example `type` Identifiers | Common Node Config / Data Keys |
| :--- | :---: | :--- | :--- |
| **Data Source** (`dataSource`) | `#0ea5e9` | `dataSource`, `temperatureSensor`, `humiditySensor`, `turbineSensor` | `sensorId`, `metric`, `unit`, `location` |
| **Math Operation** (`math`) | `#8b5cf6` | `math`, `threshold`, `movingAverage`, `comparator`, `expression` | `operator` (`>`, `<`, `==`, `>=`), `threshold`, `windowSize`, `field` |
| **Action Trigger** (`action`) | `#ef4444` | `action`, `smsAlert`, `webhook`, `emailNotification`, `mqttPublish` | `phone` / `recipient`, `url`, `method`, `template`, `message` |

---

### 2.2 Node Object Specification

```typescript
interface WorkflowNode {
  id: string;                      // Unique identifier in graph (e.g. "node_1", "sensor_temp")
  type: string;                    // Component type or subtype identifier
  label?: string;                  // Display title
  position: {                      // Canvas coordinate vector (enables 1:1 canvas reload)
    x: number;
    y: number;
  };
  data?: Record<string, any>;      // React Flow rendering metadata (color, category, UI label)
  config?: Record<string, any>;    // Rule engine execution parameters (sensorId, threshold, etc.)
}
```

---

### 2.3 Edge Object Specification

```typescript
interface WorkflowEdge {
  id?: string;                     // Optional unique edge ID (auto-generated if omitted)
  source: string;                  // Node ID of the source node (must exist in nodes array)
  target: string;                  // Node ID of the target node (must exist in nodes array)
  sourceHandle?: string | null;    // React Flow source handle identifier (e.g. "right", "out")
  targetHandle?: string | null;    // React Flow target handle identifier (e.g. "left", "in")
  animated?: boolean;              // Optional visual stroke animation flag
  style?: Record<string, any>;     // Optional visual styling object
}
```

---

### 2.4 Workflow Metadata Specification

```typescript
interface WorkflowDocument {
  id: string;                      // Normalized workflow ID (matches _id string)
  name: string;                    // Human-readable title (required, max 120 chars)
  description?: string;            // Summary of workflow intent (max 500 chars)
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'; // Default: 'draft'
  version: number;                 // Auto-incremented on each update (starts at 1)
  nodes: WorkflowNode[];           // Array of at least one node
  edges: WorkflowEdge[];           // Array of connections (validated against nodes)
  metadata?: Record<string, any>;  // Extra metadata (tags, author, environment)
  createdAt: string;               // ISO 8601 creation timestamp
  updatedAt: string;               // ISO 8601 last-modified timestamp
}
```

---

## 3. Graph Integrity & Validation Rules

1. **Unique Node IDs**: Every node inside `nodes[]` must have a non-empty string `id`, unique within that workflow. Duplicate IDs trigger a `400 Bad Request`.
2. **Dangling Edge Detection**: Every edge's `source` and `target` must resolve to an existing `id` in `nodes[]`. References to missing nodes trigger a `400 Bad Request`.
3. **Self-Loop Prevention**: Edges cannot connect a node directly to itself (`source === target`).
4. **Position Coordinates**: If `position` is provided, `x` and `y` must be valid finite numbers.
5. **Version Bumping**: When `PUT /api/workflows/:id` updates a workflow, the backend automatically increments `version` by +1 and stamps `updatedAt`.

---

## 4. API Endpoints

| Method | Route | Description | Success Status |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/workflows` | Save a new visual workflow graph | `201 Created` |
| `GET` | `/api/workflows` | List workflows (optional `?status=active`) | `200 OK` |
| `GET` | `/api/workflows/:id` | Retrieve workflow graph by ID for canvas reload | `200 OK` |
| `PUT` | `/api/workflows/:id` | Update workflow nodes, edges, or metadata | `200 OK` |
| `DELETE`| `/api/workflows/:id` | Remove a workflow graph | `200 OK` |

---

## 5. Request & Response Examples

### 5.1 Create Workflow (`POST /api/workflows`)

#### Request:
```http
POST /api/workflows HTTP/1.1
Content-Type: application/json

{
  "name": "Turbine Overheat Protection",
  "description": "Trigger SMS when turbine sensor exceeds 85°C",
  "status": "active",
  "nodes": [
    {
      "id": "node_temp_01",
      "type": "dataSource",
      "label": "Turbine Sensor",
      "position": { "x": 100, "y": 150 },
      "data": { "category": "Data Source", "color": "#0ea5e9" },
      "config": { "sensorId": "turbine-sensor-01", "metric": "temperature" }
    },
    {
      "id": "node_threshold_01",
      "type": "math",
      "label": "High Temp Threshold",
      "position": { "x": 380, "y": 150 },
      "data": { "category": "Math Operation", "color": "#8b5cf6" },
      "config": { "operator": ">", "threshold": 85.0 }
    },
    {
      "id": "node_sms_01",
      "type": "action",
      "label": "Emergency SMS Alert",
      "position": { "x": 660, "y": 150 },
      "data": { "category": "Action Trigger", "color": "#ef4444" },
      "config": { "recipient": "+15550199", "message": "CRITICAL: Turbine Temperature > 85°C" }
    }
  ],
  "edges": [
    {
      "id": "edge_temp_thresh",
      "source": "node_temp_01",
      "target": "node_threshold_01",
      "sourceHandle": "right",
      "targetHandle": "left",
      "animated": true
    },
    {
      "id": "edge_thresh_sms",
      "source": "node_threshold_01",
      "target": "node_sms_01",
      "sourceHandle": "right",
      "targetHandle": "left",
      "animated": true
    }
  ],
  "metadata": { "department": "Plant Maintenance" }
}
```

#### Response (`201 Created`):
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Workflow created successfully",
  "data": {
    "id": "6739de1a88432a9018bcfa12",
    "name": "Turbine Overheat Protection",
    "description": "Trigger SMS when turbine sensor exceeds 85°C",
    "status": "active",
    "version": 1,
    "nodes": [
      {
        "id": "node_temp_01",
        "type": "dataSource",
        "label": "Turbine Sensor",
        "position": { "x": 100, "y": 150 },
        "data": { "category": "Data Source", "color": "#0ea5e9" },
        "config": { "sensorId": "turbine-sensor-01", "metric": "temperature" }
      },
      {
        "id": "node_threshold_01",
        "type": "math",
        "label": "High Temp Threshold",
        "position": { "x": 380, "y": 150 },
        "data": { "category": "Math Operation", "color": "#8b5cf6" },
        "config": { "operator": ">", "threshold": 85.0 }
      },
      {
        "id": "node_sms_01",
        "type": "action",
        "label": "Emergency SMS Alert",
        "position": { "x": 660, "y": 150 },
        "data": { "category": "Action Trigger", "color": "#ef4444" },
        "config": { "recipient": "+15550199", "message": "CRITICAL: Turbine Temperature > 85°C" }
      }
    ],
    "edges": [
      {
        "id": "edge_temp_thresh",
        "source": "node_temp_01",
        "target": "node_threshold_01",
        "sourceHandle": "right",
        "targetHandle": "left",
        "animated": true,
        "style": {}
      },
      {
        "id": "edge_thresh_sms",
        "source": "node_threshold_01",
        "target": "node_sms_01",
        "sourceHandle": "right",
        "targetHandle": "left",
        "animated": true,
        "style": {}
      }
    ],
    "metadata": { "department": "Plant Maintenance" },
    "createdAt": "2026-11-17T09:15:38.120Z",
    "updatedAt": "2026-11-17T09:15:38.120Z"
  }
}
```

---

### 5.2 Retrieve Workflow (`GET /api/workflows/:id`)

#### Request:
```http
GET /api/workflows/6739de1a88432a9018bcfa12 HTTP/1.1
Accept: application/json
```

#### Response (`200 OK`):
Returns the complete workflow document with exact node coordinates, connection handles, and configurations to reconstruct the React Flow canvas.

---

### 5.3 Update Workflow (`PUT /api/workflows/:id`)

#### Request:
```http
PUT /api/workflows/6739de1a88432a9018bcfa12 HTTP/1.1
Content-Type: application/json

{
  "name": "Turbine Overheat Protection (Production)",
  "status": "active",
  "nodes": [
    {
      "id": "node_temp_01",
      "type": "dataSource",
      "position": { "x": 120, "y": 160 },
      "config": { "sensorId": "turbine-sensor-01" }
    },
    {
      "id": "node_threshold_01",
      "type": "math",
      "position": { "x": 400, "y": 160 },
      "config": { "operator": ">", "threshold": 90.0 }
    },
    {
      "id": "node_sms_01",
      "type": "action",
      "position": { "x": 700, "y": 160 },
      "config": { "recipient": "+15550199" }
    }
  ],
  "edges": [
    { "source": "node_temp_01", "target": "node_threshold_01" },
    { "source": "node_threshold_01", "target": "node_sms_01" }
  ]
}
```

#### Response (`200 OK`):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Workflow \"Turbine Overheat Protection (Production)\" updated successfully (version 2)",
  "data": {
    "id": "6739de1a88432a9018bcfa12",
    "name": "Turbine Overheat Protection (Production)",
    "version": 2,
    "status": "active"
  }
}
```

---

### 5.4 Validation Error Response Example (`400 Bad Request`)

When an invalid or broken graph is submitted (e.g., dangling edge or duplicate ID):

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Workflow validation failed.",
  "errors": [
    {
      "field": "edges[0].target",
      "message": "Dangling edge at edges[0]: target node \"missing_node\" does not exist in nodes list."
    }
  ]
}
```

---

## 6. Day 7: Graph Parser & Validator Specification

### 6.1 Architectural Decoupling from RxJS Execution
Graph parsing, topological ordering, and structural validation are strictly decoupled from runtime stream execution (Day 8 RxJS). The validator acts as a static compile-time analyzer that validates the AST prior to stream subscription.

### 6.2 Security & No-eval Policy
Workflow definitions and expression strings are parsed strictly as declarative configurations. Arbitrary JavaScript execution, `eval()`, `new Function()`, and VM context invocations are strictly forbidden.

### 6.3 Supported Node Categories & Connection Matrix

| Source Category | Target Category | Allowed? | Reason |
| :--- | :--- | :---: | :--- |
| `dataSource` | `math` | **YES** | Sensor telemetry streams into filter/transform |
| `dataSource` | `action` | **YES** | Direct alert on raw telemetry emission |
| `math` | `math` | **YES** | Multi-stage transformation chaining |
| `math` | `action` | **YES** | Evaluated condition triggers action sink |
| `*` | `dataSource` | **NO** | Data sources are root emitters; incoming edges forbidden |
| `action` | `*` | **NO** | Actions are terminal sinks; outgoing edges forbidden |
| `dataSource` | `dataSource` | **NO** | Telemetry emitters cannot pipe directly into emitters |
| `action` | `action` | **NO** | Actions cannot trigger downstream actions in dataflow |

### 6.4 Directed Acyclic Graph (DAG) & Cycle Detection
* **Algorithm**: Depth-First Search with 3-color state tracking (Unvisited, Visiting, Visited).
* **Cycle Path Tracing**: When a back-edge to a node in the visiting call stack is found, the exact directed cycle (e.g. `['node_a', 'node_b', 'node_a']`) is extracted and reported.
* **Topological Sort**: Kahn's in-degree queue algorithm produces the exact linear compilation sequence for stream assembly.

### 6.5 Actionable Error Codes

| Error Code | Trigger Condition |
| :--- | :--- |
| `INVALID_JSON` | Malformed JSON string |
| `INVALID_STRUCTURE` | Root body, `nodes`, or `edges` is not an object/array |
| `EMPTY_GRAPH` | `nodes` array contains 0 elements |
| `INVALID_NODE_ID` | Node ID missing or blank |
| `DUPLICATE_NODE_ID` | More than one node shares identical ID |
| `UNSUPPORTED_NODE_TYPE`| Node type not present in `NodeRegistry` |
| `INVALID_NODE_CONFIG` | Required parameters missing (e.g., `sensorId`, `windowSize`, `operator`) |
| `INVALID_EDGE_REFERENCE` | Edge source or target node ID does not exist |
| `SELF_LOOP` | Edge connects node to itself (`source === target`) |
| `DUPLICATE_EDGE` | Redundant edge between identical source/target (warning) |
| `UNSUPPORTED_CONNECTION` | Connection violates Category Matrix |
| `CYCLE_DETECTED` | Graph contains a directed cycle |
| `MISSING_SOURCE_NODE` | Graph lacks `dataSource` category nodes |
| `MISSING_ACTION_NODE` | Graph lacks `action` category sink nodes |
| `DISCONNECTED_NODE` | Node has 0 in-degree and 0 out-degree in multi-node graph |
| `UNREACHABLE_NODE` | Node cannot be reached from any data source root |
| `DEAD_END_NODE` | Intermediate math node has no downstream consumer |

---

## 7. Day 8: Graph Dependency Resolution & Execution Handler Mapping

### 7.1 Purpose & Role in Rule Engine Pipeline
The `GraphDependencyResolver` bridges static graph validation (Day 7) and reactive stream compilation (Day 9 RxJS). It compiles the validated visual graph into a concrete `ExecutionPlan` containing active adjacency lists, topological execution order, multi-level execution stages, and backend handler bindings.

### 7.2 Backend Execution Handler Mapping Table

| Visual Node Type | Execution Handler ID | Category | Type | Target RxJS Operator / Pattern |
| :--- | :--- | :---: | :---: | :--- |
| `dataSource`, `sensor`, `source` | `telemetrySourceHandler` | `dataSource` | `source` | `telemetryStream` (Observable source) |
| `temperatureSensor` | `temperatureSensorHandler` | `dataSource` | `source` | `telemetryStream` (Temperature metric) |
| `humiditySensor` | `humiditySensorHandler` | `dataSource` | `source` | `telemetryStream` (Humidity metric) |
| `pressureSensor` | `pressureSensorHandler` | `dataSource` | `source` | `telemetryStream` (Pressure metric) |
| `turbineSensor` | `turbineSensorHandler` | `dataSource` | `source` | `telemetryStream` (RPM/Vibration metric) |
| `threshold`, `comparator` | `thresholdFilterHandler` | `math` | `operator` | `filter(...)` operator |
| `movingAverage`, `average` | `movingAverageHandler` | `math` | `operator` | `scan(...)` rolling buffer window |
| `transform` | `dataTransformHandler` | `math` | `operator` | `map(...)` mathematical projection |
| `filter` | `predicateFilterHandler` | `math` | `operator` | `filter(...)` predicate operator |
| `expression` | `declarativeExpressionHandler` | `math` | `operator` | `map(...)` safe expression evaluator |
| `smsAlert`, `sms` | `smsAlertHandler` | `action` | `sink` | `tap(...)` / Emergency SMS notification |
| `webhook`, `http` | `webhookDispatchHandler` | `action` | `sink` | `tap(...)` / HTTP POST webhook dispatch |
| `emailNotification`, `email` | `emailNotificationHandler` | `action` | `sink` | `tap(...)` / Email alert delivery |
| `mqttPublish`, `mqtt` | `mqttPublishHandler` | `action` | `sink` | `tap(...)` / MQTT broker event publish |

### 7.3 Disconnected Node Handling Strategies

* **`PRUNE` (Default)**: Automatically prunes isolated nodes (`inDegree = 0 && outDegree = 0`) and unreachable subgraphs from the active execution plan. Enables drafting on canvas while running verified sub-flows.
* **`REJECT`**: Strictly fails dependency resolution (`DISCONNECTED_NODES_REJECTED`) if any disconnected or unreachable nodes exist.
* **`WARN`**: Prunes disconnected nodes but attaches diagnostic warnings to the plan metadata.

### 7.4 Execution Stages & Stream Compilation Plan
* **Execution Stages (`executionStages[]`)**: Groups nodes into concurrent levels. Stage 0 contains stream entrypoints (`dataSource`). Stage $k$ contains nodes whose deepest dependency is at Stage $k-1$.
* **Dataflow Pipelines (`pipelines[]`)**: Traces each source node to all reachable terminal sinks, defining individual reactive event pathways for RxJS compilation.


