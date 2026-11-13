
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";

const alerts = [
  {
    id: 1,
    title: "High Temperature Detected",
    device: "Turbine-01",
    message: "Temperature exceeded 80°C",
    severity: "Critical",
    time: "Just now",
  },
  {
    id: 2,
    title: "Pressure Sensor Offline",
    device: "Pressure-03",
    message: "Device connection lost",
    severity: "Warning",
    time: "12 minutes ago",
  },
  {
    id: 3,
    title: "Humidity Normal",
    device: "Humidity-02",
    message: "Humidity returned to normal",
    severity: "Info",
    time: "25 minutes ago",
  },
];

function AlertHistory() {
  return (
    <div className="panel-card">
      <h3>Alert History</h3>
      <p className="panel-subtitle">Recent system events</p>

      {alerts.map((alert) => (
        <div className="history-row" key={alert.id}>
          <div className={`history-icon ${alert.severity.toLowerCase()}`}>
            {alert.severity === "Info"
              ? <CheckCircle size={19} />
              : <AlertTriangle size={19} />
            }
          </div>

          <div className="history-content">
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
            <small>
              <Clock size={12} /> {alert.time} · {alert.device}
            </small>
          </div>

          <span className={`severity ${alert.severity.toLowerCase()}`}>
            {alert.severity}
          </span>
        </div>
      ))}
    </div>
  );
}

export default AlertHistory;
