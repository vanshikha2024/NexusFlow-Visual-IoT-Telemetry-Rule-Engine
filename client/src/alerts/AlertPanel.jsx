
import { Bell, AlertTriangle } from "lucide-react";

function AlertPanel() {
  return (
    <div className="panel-card">
      <div className="panel-heading">
        <h3>Recent Alerts</h3>
        <Bell size={19} />
      </div>

      <div className="alert-item">
        <AlertTriangle color="#fb923c" />
        <div>
          <strong>High Temperature</strong>
          <p>Turbine temperature exceeded 80°C</p>
          <small>Just now · Demo alert</small>
        </div>
      </div>

      <div className="alert-item">
        <AlertTriangle color="#38bdf8" />
        <div>
          <strong>Device Connection</strong>
          <p>Sensor T-02 is online</p>
          <small>2 minutes ago · Demo event</small>
        </div>
      </div>
    </div>
  );
}

export default AlertPanel;
