
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const humidityData = [
  { time: "09:00", humidity: 55 },
  { time: "09:10", humidity: 58 },
  { time: "09:20", humidity: 60 },
  { time: "09:30", humidity: 57 },
  { time: "09:40", humidity: 63 },
  { time: "09:50", humidity: 61 },
  { time: "10:00", humidity: 62.4 },
];

function HumidityChart() {
  return (
    <div className="panel-card chart-card">
      <div className="chart-header">
        <div>
          <h3>Humidity Monitoring</h3>
          <p>Live environmental humidity readings</p>
        </div>

        <span className="chart-unit">%</span>
      </div>

      <div className="chart-current-value">
        62.4 <span>%</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={humidityData}
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
            formatter={(value) => [`${value}%`, "Humidity"]}
          />

          <Line
            type="monotone"
            dataKey="humidity"
            stroke="#2dd4bf"
            strokeWidth={3}
            dot={{ fill: "#2dd4bf", r: 4 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="chart-note">
        Demo telemetry · Environmental monitoring
      </p>
    </div>
  );
}

export default HumidityChart;
