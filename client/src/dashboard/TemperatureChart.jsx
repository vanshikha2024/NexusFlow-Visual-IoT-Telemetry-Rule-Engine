
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const temperatureData = [
  { time: "09:00", temperature: 68 },
  { time: "09:10", temperature: 70 },
  { time: "09:20", temperature: 72 },
  { time: "09:30", temperature: 69 },
  { time: "09:40", temperature: 75 },
  { time: "09:50", temperature: 78 },
  { time: "10:00", temperature: 85.6 },
];

function TemperatureChart() {
  return (
    <div className="panel-card chart-card">
      <div className="chart-header">
        <div>
          <h3>Temperature Monitoring</h3>
          <p>Live turbine temperature readings</p>
        </div>

        <span className="chart-unit">°C</span>
      </div>

      <div className="chart-current-value">
        85.6 <span>°C</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={temperatureData}
          margin={{ top: 15, right: 10, left: -15, bottom: 5 }}
        >
          <CartesianGrid
            stroke="#263244"
            strokeDasharray="4 4"
          />

          <XAxis
            dataKey="time"
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
          />

          <YAxis
            stroke="#94a3b8"
            tick={{ fontSize: 11 }}
            domain={[0, 100]}
          />

          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#fff"
            }}
            formatter={(value) => [`${value} °C`, "Temperature"]}
          />

          <Line
            type="monotone"
            dataKey="temperature"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={{ fill: "#38bdf8", r: 4 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="chart-note">
        Demo telemetry · Threshold: 80°C
      </p>
    </div>
  );
}

export default TemperatureChart;
