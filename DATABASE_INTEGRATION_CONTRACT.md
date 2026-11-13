# NexusFlow: MongoDB Telemetry Integration Contract

**Backend Engineer**: Ankit Singh (`teamleader2`)  
**Database Lead**: Rishi (`RishiBanna`)  
**Status**: Contract Drafted (Awaiting Schema Confirmation from Rishi)  

---

## 1. Overview & Non-Interference Policy
Teammate Rishi owns the MongoDB database design, DDL scripts, and Time-Series collection specifications. The backend repository is architected to interface with MongoDB cleanly without independently executing DDL commands (`createCollection`, altering collection options, or creating conflicting indexes).

Since Rishi's schema has not yet been committed to `origin/RishiBanna`, the backend implements this **Integration Contract** with fully configurable defaults that seamlessly adapt once Rishi publishes his schema.

---

## 2. Agreed Time-Series Configuration (Defaults)

| Configuration Parameter | Default Value | Environment Variable Override | Purpose |
| :--- | :--- | :--- | :--- |
| **Database Name** | `nexusflow` | `DB_NAME` | Target MongoDB database |
| **Collection Name** | `telemetry` | `TELEMETRY_COLLECTION` | Time-Series collection |
| **Time Field (`timeField`)** | `timestamp` | `TELEMETRY_TIME_FIELD` | Mandatory BSON `Date` field |
| **Meta Field (`metaField`)** | `metadata` | `TELEMETRY_META_FIELD` | Grouping metadata for bucket optimization |
| **Sensor ID Key** | `sensorId` | `TELEMETRY_SENSOR_ID_KEY` | Key inside `metadata` identifying sensor |
| **Granularity** | `seconds` | `TELEMETRY_GRANULARITY` | Time-Series bucket granularity |

---

## 3. Standard Document Structure

```json
{
  "timestamp": "2026-11-13T06:00:00.000Z",
  "metadata": {
    "sensorId": "turbine-sensor-01",
    "sensorType": "Turbine Sensor",
    "location": "Sector 4"
  },
  "value": 1850.5,
  "unit": "RPM"
}
```

* **Timestamp**: Converted to a valid BSON `Date` prior to persistence.
* **Metadata**: Nested object containing sensor identification and attributes.
* **Measurements**: Numeric metrics (`value`, `temperature`, `pressure`, etc.) and units.

---

## 4. Required Schema Information from Rishi

Please confirm or update the following parameters:

1. **Database Name**: Is the database named `nexusflow`, or is there an alternative name (e.g. `nexusflow_iot`)?
2. **Collection Name**: Is the telemetry collection named `telemetry` or something else (e.g. `sensor_telemetry`)?
3. **`timeField` Name**: Do you use `timestamp`, `time`, or `recordedAt`?
4. **`metaField` Structure**: 
   * Is metadata nested under `metadata`?
   * What key identifies the sensor (`sensorId`, `deviceId`, or `id`)?
   * What additional metadata fields (e.g. `sensorType`, `siteId`, `firmwareVersion`) should the backend capture?
5. **Measurement Types & Units**: What measurement field conventions do you expect (`value`, `metric`, `reading`, or dynamic key-value pairs)?
6. **Time-Series Granularity**: Is `seconds` optimal, or should it be `minutes` / `hours`?
7. **TTL / Expiry**: Do you plan to configure `expireAfterSeconds` on the Time-Series collection?

---

## 5. Backend Repository Capabilities

The backend telemetry repository (`TelemetryRepository`) provides:
* `insertTelemetry(record)`: Normalizes and inserts a single telemetry record.
* `insertManyTelemetry(records)`: Performs high-throughput batch inserts.
* `findTelemetryBySensor(sensorId, options)`: Queries telemetry with optional `startTime`, `endTime`, `limit`, and `sort`.
* `getLatestTelemetry(sensorId)`: Retrieves the most recent telemetry document for a sensor.
* Connection resilience: Handles connection dropouts gracefully without crashing the server.
