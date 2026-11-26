import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { getSensorTelemetry } from "../services/api";

const SENSOR_IDS = [
  "demo-turbine-01",
  "demo-turbine-02",
  "demo-turbine-03",
];

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function useTelemetry() {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);

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

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      setLiveConnected(true);
    });

    socket.on("disconnect", () => {
      setLiveConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("Telemetry socket connection failed:", err.message);
      setLiveConnected(false);
    });

    socket.on("telemetry:new", (record) => {
      const sensorId =
        record?.metadata?.sensorId || record?.sensorId;

      if (!sensorId || !SENSOR_IDS.includes(sensorId)) return;

      setSensors((currentSensors) =>
        currentSensors.map((sensor) => {
          if (sensor.sensorId !== sensorId) return sensor;

          const updatedRecords = [
            record,
            ...sensor.records.filter(
              (existing) =>
                existing._id !== record._id ||
                !record._id
            ),
          ]
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
            )
            .slice(0, 100);

          return {
            ...sensor,
            records: updatedRecords,
          };
        })
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return {
    sensors,
    loading,
    error,
    liveConnected,
    refreshTelemetry: fetchTelemetry,
  };
}
