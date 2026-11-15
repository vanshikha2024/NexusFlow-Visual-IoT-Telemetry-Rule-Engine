
import { useEffect, useState } from "react";
import { getTelemetryMetrics } from "../services/api";

export default function TelemetryMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = async () => {
    try {
      const data = await getTelemetryMetrics();
      setMetrics(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    const interval = setInterval(fetchMetrics, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>Loading telemetry metrics...</p>;
  if (error) return <p>Metrics error: {error}</p>;
  if (!metrics) return <p>No metrics available.</p>;

  const cards = [
    {
      label: "Total Records",
      value: metrics.database?.totalRecords ?? 0,
    },
    {
      label: "Active Sensors",
      value: metrics.database?.activeSensors ?? 0,
    },
    {
      label: "Total Ingested",
      value: metrics.totalIngested ?? 0,
    },
    {
      label: "Failed Ingestion",
      value: metrics.totalFailed ?? 0,
    },
    {
      label: "HTTP Requests",
      value: metrics.totalRequests ?? 0,
    },
    {
      label: "Average Latency",
      value: `${metrics.averageLatency ?? 0} ms`,
    },
  ];

  return (
    <section className="telemetry-metrics">
      <div className="metrics-heading">
        <div>
          <h2>System Metrics</h2>
          <p>Live IoT telemetry and backend performance</p>
        </div>

        <span>
          {metrics.database?.status === "connected"
            ? "Database Connected"
            : "Database Disconnected"}
        </span>
      </div>

      <div className="metrics-grid">
        {cards.map((card) => (
          <div className="metric-card" key={card.label}>
            <h3>{card.label}</h3>
            <p>{card.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
