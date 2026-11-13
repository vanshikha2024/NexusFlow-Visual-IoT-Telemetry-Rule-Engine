
import { Cpu, Wifi, WifiOff, Clock, Activity } from "lucide-react";

const devices = [
  {
    id: "DEV-001",
    name: "Turbine Temperature Sensor",
    type: "Temperature",
    status: "Online",
    lastSeen: "Just now",
  },
  {
    id: "DEV-002",
    name: "Factory Humidity Sensor",
    type: "Humidity",
    status: "Online",
    lastSeen: "Just now",
  },
  {
    id: "DEV-003",
    name: "Pressure Monitoring Unit",
    type: "Pressure",
    status: "Offline",
    lastSeen: "12 minutes ago",
  },
  {
    id: "DEV-004",
    name: "Motor Vibration Sensor",
    type: "Vibration",
    status: "Online",
    lastSeen: "Just now",
  },
];

function DeviceStatus() {
  const onlineCount = devices.filter(
    (device) => device.status === "Online"
  ).length;

  const offlineCount = devices.length - onlineCount;

  return (
    <div className="panel-card device-panel">

      <div className="panel-heading">
        <div>
          <h3>Device Monitoring</h3>
          <p className="panel-subtitle">
            Connected factory devices
          </p>
        </div>

        <Cpu size={22} color="#38bdf8" />
      </div>

      <div className="device-summary">
        <div>
          <span className="summary-number online-text">
            {onlineCount}
          </span>
          <span className="summary-label">Online</span>
        </div>

        <div>
          <span className="summary-number offline-text">
            {offlineCount}
          </span>
          <span className="summary-label">Offline</span>
        </div>

        <div>
          <span className="summary-number">
            {devices.length}
          </span>
          <span className="summary-label">Total</span>
        </div>
      </div>

      <div className="device-list">
        {devices.map((device) => (
          <div className="device-row" key={device.id}>

            <div className="device-icon">
              <Activity size={19} />
            </div>

            <div className="device-info">
              <strong>{device.name}</strong>
              <span>
                {device.id} · {device.type}
              </span>
            </div>

            <div className="device-status-info">
              <span className={`device-badge ${
                device.status === "Online"
                  ? "device-online"
                  : "device-offline"
              }`}>
                {device.status === "Online"
                  ? <Wifi size={12} />
                  : <WifiOff size={12} />
                }
                {device.status}
              </span>

              <small>
                <Clock size={11} />
                {device.lastSeen}
              </small>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}

export default DeviceStatus;
