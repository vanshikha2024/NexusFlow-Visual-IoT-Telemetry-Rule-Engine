
import { useCallback, useEffect, useState } from "react";
import { getSensorTelemetry } from "../services/api";

const SENSOR_IDS = [
  "demo-turbine-01",
  "demo-turbine-02",
  "demo-turbine-03",
];

export default function useTelemetry() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTelemetry = useCallback(async () => {
    try {
      setError(null);

      const results = await Promise.all(
        SENSOR_IDS.map(async (sensorId) => {
          const records = await getSensorTelemetry(sensorId, {
            limit: 100,
          });

          const sortedRecords = Array.isArray(records)
            ? [...records].sort(
                (a, b) =>
                  new Date(b.timestamp).getTime() -
                  new Date(a.timestamp).getTime()
              )
            : [];

          return {
            sensorId,
            records: sortedRecords,
          };
        })
      );

      setSensors(results);
    } catch (err) {
      console.error("Telemetry fetch failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();

    const intervalId = setInterval(fetchTelemetry, 5000);

    return () => clearInterval(intervalId);
  }, [fetchTelemetry]);

  return {
    sensors,
    loading,
    error,
    refreshTelemetry: fetchTelemetry,
  };
}
