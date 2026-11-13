
import { Thermometer, Droplets, Cpu, TrendingUp } from "lucide-react";

const sensors = [
  {
    title: "Temperature",
    value: "85.6",
    unit: "°C",
    status: "Above normal",
    change: "+4.2%",
    icon: Thermometer,
    color: "orange",
    trend: "Increasing",
  },
  {
    title: "Humidity",
    value: "62.4",
    unit: "%",
    status: "Normal range",
    change: "+1.8%",
    icon: Droplets,
    color: "blue",
    trend: "Stable",
  },
  {
    title: "Active Devices",
    value: "24",
    unit: "",
    status: "Devices online",
    change: "24 / 28",
    icon: Cpu,
    color: "green",
    trend: "Connected",
  },
];

function SensorCards() {
  return (
    <section className="sensor-grid">
      {sensors.map((sensor) => {
        const Icon = sensor.icon;

        return (
          <div className="sensor-card" key={sensor.title}>
            <div className="sensor-card-top">
              <div>
                <p className="sensor-title">{sensor.title}</p>
                <div className="sensor-value">
                  {sensor.value}
                  <span>{sensor.unit}</span>
                </div>
              </div>

              <div className={`sensor-icon ${sensor.color}`}>
                <Icon size={23} />
              </div>
            </div>

            <div className="sensor-card-bottom">
              <span className={`sensor-status ${sensor.color}`}>
                <span className="status-dot"></span>
                {sensor.status}
              </span>

              <span className="sensor-change">
                <TrendingUp size={14} />
                {sensor.change}
              </span>
            </div>

            <p className="sensor-trend">{sensor.trend}</p>
          </div>
        );
      })}
    </section>
  );
}

export default SensorCards;
