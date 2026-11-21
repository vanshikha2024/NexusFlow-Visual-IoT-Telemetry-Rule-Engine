import { useCallback, useEffect, useState } from "react";

import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import {
  Save,
  Trash2,
  FolderOpen,
  Eraser,
  ShieldCheck,
  Play,
} from "lucide-react";

import Sidebar from "./Sidebar";
import CustomNode from "./CustomNode";
import ConfigPanel from "./ConfigPanel";
import {
  createWorkflow,
  getWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
  validateWorkflowGraph,
} from "../services/api";

const nodeTypes = {
  dataSource: CustomNode,
  math: CustomNode,
  action: CustomNode,
};

let idCounter = 0;

const nextId = (existingNodes = []) => {
  const existingIds = new Set(
    existingNodes.map((node) => node.id)
  );

  let newId;

  do {
    idCounter += 1;
    newId = `node_${idCounter}`;
  } while (existingIds.has(newId));

  return newId;
};

function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [workflowName, setWorkflowName] = useState("My First Workflow");
  const [workflowId, setWorkflowId] = useState(null);
  const [message, setMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) || null;

  const updateNodeConfig = (key, value) => {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: {
                ...node.data,
                config: {
                  ...(node.data.config || {}),
                  [key]: value,
                },
              },
            }
          : node
      )
    );
  };

  const { screenToFlowPosition } = useReactFlow();
  const handleValidateWorkflow = async () => {
  try {
    const validation = await validateWorkflowGraph({
      nodes,
      edges,
    });

    const errors = (validation.errors || []).map(
      (item) => item.message || String(item)
    );

    setValidationErrors(errors);
    setValidationSuccess(validation.isValid);

    if (validation.isValid) {
      setMessage("Workflow validation successful! Ready for execution.");
    } else {
      setMessage(`Workflow validation failed: ${errors.length} issue(s) found.`);
    }
  } catch (error) {
    console.error("Workflow validation failed:", error);
    setValidationErrors([error.message]);
    setValidationSuccess(false);
    setMessage("Unable to validate workflow with the backend.");
  }
};

  const handleExecuteWorkflow = async () => {
    // A saved workflow ID is required by the backend.
    if (!workflowId) {
      setMessage("Please save your workflow before executing.");
      return;
    }

    try {
      setExecuting(true);
      setExecutionResult(null);
      setMessage("Validating workflow...");

      // Validate using the backend graph validator.
      const validation = await validateWorkflowGraph({
        nodes,
        edges,
      });

      const errors = (validation.errors || []).map(
        (item) => item.message || String(item)
      );

      setValidationErrors(errors);
      setValidationSuccess(validation.isValid);

      // Stop execution when validation fails.
      if (!validation.isValid) {
        setMessage(
          `Execution stopped. Workflow validation failed: ${errors.length} issue(s) found.`
        );
        return;
      }

      setMessage("Executing workflow...");

      const API_URL =
        import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

      const response = await fetch(
        `${API_URL}/api/workflows/${encodeURIComponent(workflowId)}/execute`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        const executionErrors = (result.errors || []).map(
          (item) => item.message || String(item)
        );

        if (executionErrors.length > 0) {
          setValidationErrors(executionErrors);
          setValidationSuccess(false);
        }

        throw new Error(
          result.message || "Workflow execution failed."
        );
      }

      setExecutionResult(result.data);
      setMessage("Workflow executed successfully!");
    } catch (error) {
      console.error("Workflow execution failed:", error);
      setMessage(error.message || "Workflow execution failed.");
    } finally {
      setExecuting(false);
    }
  };

  const onConnect = useCallback(
    (params) => {
      setEdges((currentEdges) =>
        addEdge({ ...params, animated: true }, currentEdges)
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const raw = event.dataTransfer.getData("application/nexusflow");

      if (!raw) return;

      try {
        const item = JSON.parse(raw);

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setNodes((currentNodes) =>
          currentNodes.concat({
            id: nextId(currentNodes),
            type: item.type,
            position,
            data: item,
          })
        );
      } catch {
        setMessage("Unable to add node.");
      }
    },
    [screenToFlowPosition, setNodes]
  );

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      setMessage("Please enter a workflow name.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const workflowData = {
        name: workflowName.trim(),
        nodes,
        edges,
        status: "draft",
      };

      let savedWorkflow;

      if (workflowId) {
        savedWorkflow = await updateWorkflow(workflowId, workflowData);
      } else {
        savedWorkflow = await createWorkflow(workflowData);
        setWorkflowId(savedWorkflow.id || savedWorkflow._id);
      }
      await refreshWorkflows();

      setMessage("Workflow saved to the database successfully!");
    } catch (error) {
      console.error("Workflow save failed:", error);
      setMessage(error.message || "Unable to save workflow.");
    } finally {
      setLoading(false);
    }
  };

  const refreshWorkflows = async () => {
    try {
      const result = await getWorkflows();
      const workflows = result.workflows || [];
      setSavedWorkflows(workflows);
    } catch (error) {
      console.error("Failed to load workflows:", error);
    }
  };
  useEffect(() => {
    refreshWorkflows();
  }, []);

  const loadWorkflow = async () => {
    try {
      setLoading(true);

      let id = selectedWorkflowId;

      // If no dropdown selection, search by workflow name
      if (!id) {
        const result = await getWorkflows();
        const workflows = result.workflows || [];

        const workflow = workflows.find(
          (item) => item.name === workflowName.trim()
        );

        if (!workflow) {
          setMessage("No workflow found with that name.");
          return;
        }

        id = workflow.id || workflow._id;
      }

      const fullWorkflow = await getWorkflowById(id);

      setWorkflowId(fullWorkflow.id || fullWorkflow._id);
      setWorkflowName(fullWorkflow.name);
      setNodes(fullWorkflow.nodes || []);
      setEdges(fullWorkflow.edges || []);
      setSelectedWorkflowId(id);

      setMessage("Workflow loaded successfully!");
    } catch (error) {
      console.error("Load workflow failed:", error);
      setMessage("Failed to load workflow.");
    } finally {
      setLoading(false);
    }
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setWorkflowId(null);
    setMessage("Canvas cleared. Save to create a new workflow.");
  };

  const handleDeleteWorkflow = async () => {
    if (!selectedWorkflowId) {
      setMessage("Please select a workflow to delete.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this workflow?")) {
      return;
    }

    try {
      await deleteWorkflow(selectedWorkflowId);
      setSelectedWorkflowId("");
      setWorkflowId(null);
      setWorkflowName("");
      setNodes([]);
      setEdges([]);
      setMessage("Workflow deleted successfully!");
      await refreshWorkflows();
    } catch (error) {
      console.error("Delete workflow failed:", error);
      setMessage("Failed to delete workflow.");
    }
  };

  return (
    <div className="workflow-page">
      <div className="workflow-toolbar">
        <input
          type="text"
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          placeholder="Enter workflow name"
        />

        <select
          value={selectedWorkflowId}
          onChange={(e) => setSelectedWorkflowId(e.target.value)}
        >
          <option value="">Select saved workflow</option>
          {savedWorkflows.map((workflow) => (
            <option
              key={workflow.id || workflow._id}
              value={workflow.id || workflow._id}
            >
              {workflow.name}
            </option>
          ))}
        </select>
   
        <button title="Save Workflow" onClick={saveWorkflow} disabled={loading}>
          <Save size={17} /> Save
        </button>

        <button title="Delete Workflow" onClick={handleDeleteWorkflow}>
          <Trash2 size={17} /> Delete
        </button>

        <button title="Load Workflow" onClick={loadWorkflow} disabled={loading}>
          <FolderOpen size={17} /> Load
        </button>

        <button title="Clear Canvas" onClick={clearCanvas} disabled={loading}>
          <Eraser size={17} /> Clear
        </button>

        <button title="Validate Workflow" onClick={handleValidateWorkflow} disabled={loading}>
          <ShieldCheck size={17} /> Validate
        </button>

        <button
          title="Execute Workflow"
          onClick={handleExecuteWorkflow}
          disabled={loading || executing}
        >
          <Play size={17} />
          {executing ? "Running..." : "Run"}
        </button>

      </div>

      {message && <p className="workflow-message">{message}</p>}
      {validationErrors.length > 0 && (
        <div className="validation-errors">
          <h3>Workflow Validation Failed</h3>
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validationSuccess && (
        <div className="validation-success">
          <strong>✓ Workflow is valid!</strong>
          <p>Your workflow is ready for execution.</p>
        </div>
      )}

      {executionResult && (
        <div className="workflow-execution-results">
          <h3>Execution Results</h3>

          <p>
            Status: <strong>{executionResult.status}</strong>
          </p>

          <p>
            Mode: {executionResult.mode}
          </p>

          <h4>Node Execution Log</h4>

          {executionResult.executionLog?.map((node, index) => (
            <div
              className="workflow-execution-node"
              key={`${node.nodeId}-${index}`}
            >
              <strong>{node.nodeName}</strong>

              <span>{node.status}</span>

              <pre>
                {JSON.stringify(node.output, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="workflow-layout">
        <Sidebar />

        <div className="workflow-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            onDrop={onDrop}
            onDragOver={onDragOver}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
          >
            <Background gap={20} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <ConfigPanel
          node={selectedNode}
          onChange={updateNodeConfig}
        />
      </div>
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
