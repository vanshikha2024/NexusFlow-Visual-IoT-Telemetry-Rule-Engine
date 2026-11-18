
import { Workflow, CheckCircle, Play, Clock } from "lucide-react";

const workflows = [
  {
    id: "WF-001",
    name: "Turbine Temperature Alert",
    description: "Temperature greater than 80°C",
    status: "Triggered",
    time: "Just now",
  },
  {
    id: "WF-002",
    name: "Humidity Monitoring",
    description: "Monitor humidity levels",
    status: "Running",
    time: "Active",
  },
  {
    id: "WF-003",
    name: "Pressure Monitoring",
    description: "Monitor pressure sensor",
    status: "Completed",
    time: "10 minutes ago",
  },
];

function ExecutionStatus() {
  return (
    <div className="panel-card workflow-panel">
      <div className="panel-heading">
        <div>
          <h3>Workflow Execution Status</h3>
          <p className="panel-subtitle">
            Monitor automation activities
          </p>
        </div>
        <Workflow color="#38bdf8" size={23} />
      </div>

      {workflows.map((workflow) => (
        <div className="workflow-row" key={workflow.id}>
          <div className="workflow-icon">
            <Play size={18} />
          </div>

          <div className="workflow-info">
            <strong>{workflow.name}</strong>
            <p>{workflow.description}</p>
            <small>
              <Clock size={12} /> {workflow.time}
            </small>
          </div>

          <span className={`workflow-badge ${
            workflow.status.toLowerCase()
          }`}>
            {workflow.status === "Completed" && (
              <CheckCircle size={12} />
            )}
            {workflow.status}
          </span>
        </div>
      ))}
    </div>
  );
}

export default ExecutionStatus;
