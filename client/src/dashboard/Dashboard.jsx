
import { useState } from "react";

import {
  LayoutDashboard,
  Cpu,
  Bell,
  Workflow,
  Settings,
  Search,
  Activity,
  Wifi,
} from "lucide-react";

import SensorCards from "./SensorCards";
import TemperatureChart from "./TemperatureChart";
import HumidityChart from "./HumidityChart";
import DeviceStatus from "./DeviceStatus";
import AlertPanel from "../alerts/AlertPanel";
import ExecutionStatus from "../workflow/ExecutionStatus";
import WorkflowEditor from "../workflow/WorkflowEditor";
import TurbineMonitoring from "./TurbineMonitoring";
import TelemetryMetrics from "./TelemetryMetrics";

function Dashboard() {
  const [activePage, setActivePage] = useState("Dashboard");

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Devices", icon: Cpu },
    { name: "Workflows", icon: Workflow },
    { name: "Alerts", icon: Bell },
    { name: "Settings", icon: Settings },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2 className="logo">
          Nexus<span>Flow</span>
        </h2>

        <p className="nav-label">MAIN MENU</p>

        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              className={`nav-item ${
                activePage === name ? "active" : ""
              }`}
              onClick={() => setActivePage(name)}
            >
              <Icon size={18} />
              {name}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="online-dot"></div>
          System operational
        </div>
      </aside>

      <main className="main-content">
        {activePage === "Workflows" ? (
          <>
            <header className="topbar">
              <div>
                <h2>Visual Workflow Builder</h2>
                <p>
                  Build IoT automation rules using connected nodes.
                </p>
              </div>

              <div className="header-actions">
                <span className="connection">
                  <Wifi size={16} /> Connected
                </span>
              </div>
            </header>

            <WorkflowEditor />
          </>
        ) : (
          <>
            <header className="topbar">
              <div>
                <h2>{activePage === "Dashboard" ? "IoT Overview" : activePage}</h2>
                <p>Monitor your devices and telemetry in real time.</p>
              </div>

              <div className="header-actions">
                <span className="connection">
                  <Wifi size={16} /> Connected
                </span>
                <button className="icon-button">
                  <Search />
                </button>
                <button className="icon-button">
                  <Bell />
                </button>
              </div>
            </header>

            {activePage === "Dashboard" ? (
              <>
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
                <TelemetryMetrics />
                <ExecutionStatus />

                <footer className="dashboard-footer">
                  NexusFlow · Visual IoT Telemetry & Rule Engine
                </footer>
              </>
            ) : (
              <section className="welcome-section">
                <div>
                  <h1>{activePage}</h1>
                  <p>
                    This section will be integrated into NexusFlow.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
