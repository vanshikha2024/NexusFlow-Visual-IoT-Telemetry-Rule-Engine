
import {
  LayoutDashboard,
  Cpu,
  Bell,
  Workflow,
  Settings,
  Search,
  Activity,
  Wifi,
  Menu
} from "lucide-react";

import SensorCards from "./SensorCards";
import TemperatureChart from "./TemperatureChart";
import HumidityChart from "./HumidityChart";
import DeviceStatus from "./DeviceStatus";
import AlertPanel from "../alerts/AlertPanel";
import ExecutionStatus from "../workflow/ExecutionStatus";
import TurbineMonitoring from "./TurbineMonitoring";

function Dashboard() {
  return (
    <div className="app-layout">

      <aside className="sidebar">
        <h2 className="logo">Nexus<span>Flow</span></h2>

        <p className="nav-label">MAIN MENU</p>

        <nav>
          <a className="nav-item active"><LayoutDashboard /> Dashboard</a>
          <a className="nav-item"><Cpu /> Devices</a>
          <a className="nav-item"><Workflow /> Workflows</a>
          <a className="nav-item"><Bell /> Alerts</a>
          <a className="nav-item"><Settings /> Settings</a>
        </nav>

        <div className="sidebar-footer">
          <div className="online-dot"></div>
          System operational
        </div>
      </aside>

      <main className="main-content">

        <header className="topbar">
          <div>
            <h2>IoT Overview</h2>
            <p>Monitor your devices and telemetry in real time.</p>
          </div>

          <div className="header-actions">
            <span className="connection">
              <Wifi size={16} /> Connected
            </span>
            <button className="icon-button"><Search /></button>
            <button className="icon-button"><Bell /></button>
          </div>
        </header>

        <section className="welcome-section">
          <div>
            <h1>Welcome to NexusFlow</h1>
            <p>Your industrial IoT monitoring center.</p>
          </div>
          <button className="primary-button">
            <Activity size={17} /> System Overview
          </button>
        </section>

        <SensorCards />

        <section className="charts-grid">
          <TemperatureChart />
          <HumidityChart />
        </section>

        <section className="bottom-grid">
          <DeviceStatus />
          <AlertPanel />
        </section>

        <TurbineMonitoring />

        <ExecutionStatus />

        <footer className="dashboard-footer">
          NexusFlow · Visual IoT Telemetry & Rule Engine
        </footer>

      </main>
    </div>
  );
}

export default Dashboard;
