
import { Activity, RefreshCw, Gauge } from "lucide-react";
import useTelemetry from "../hooks/useTelemetry";

function TurbineMonitoring() {
  const {
    sensors,
    loading,
    error,
    refreshTelemetry,
  } = useTelemetry();

  return (
    <section className="panel-card">
      <div className="panel-heading">
        <div>
          <h3>Turbine RPM Monitoring</h3>
          <p className="panel-subtitle">
            Live readings from MongoDB
          </p>
        </div>

        <button
          className="icon-button"
          onClick={refreshTelemetry}
          title="Refresh readings"
          disabled={loading}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {loading && <p>Loading turbine readings...</p>}

      {error && (
        <p role="alert">
          Unable to load telemetry: {error}
        </p>
      )}

      {!loading && !error && sensors.map((sensor) => {
        const latest = sensor.records[0];

        return (
          <div className="device-row" key={sensor.sensorId}>
            <div className="device-icon">
              <Gauge size={20} />
            </div>

            <div className="device-info">
              <strong>{sensor.sensorId}</strong>
              <span>
                {sensor.records.length} stored readings
              </span>
            </div>

            <div className="device-status-info">
              <strong>
                {latest
                  ? `${latest.value} ${latest.unit || ""}`
                  : "No readings"}
              </strong>

              <small>
                <Activity size={12} />
                {latest
                  ? new Date(latest.timestamp).toLocaleTimeString()
                  : "Waiting for data"}
              </small>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export default TurbineMonitoring;
