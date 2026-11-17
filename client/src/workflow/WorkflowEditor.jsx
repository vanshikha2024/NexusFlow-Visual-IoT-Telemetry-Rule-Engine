
import { useCallback, useState } from "react";

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

import Sidebar from "./Sidebar";
import CustomNode from "./CustomNode";

const nodeTypes = {
  dataSource: CustomNode,
  math: CustomNode,
  action: CustomNode,
};

let idCounter = 0;

const nextId = () => `node_${++idCounter}`;

function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [workflowName, setWorkflowName] = useState("My First Workflow");
  const [message, setMessage] = useState("");

  const { screenToFlowPosition } = useReactFlow();

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

      const raw = event.dataTransfer.getData(
        "application/nexusflow"
      );

      if (!raw) return;

      try {
        const item = JSON.parse(raw);

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        setNodes((currentNodes) =>
          currentNodes.concat({
            id: nextId(),
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

  const saveWorkflow = () => {
    if (!workflowName.trim()) {
      setMessage("Please enter a workflow name.");
      return;
    }

    const workflow = {
      name: workflowName.trim(),
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    };

    try {
      const saved = JSON.parse(
        localStorage.getItem("nexusflow-workflows") || "{}"
      );

      saved[workflow.name] = workflow;

      localStorage.setItem(
        "nexusflow-workflows",
        JSON.stringify(saved)
      );

      setMessage("Workflow saved successfully!");
    } catch {
      setMessage("Unable to save workflow.");
    }
  };

  const loadWorkflow = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("nexusflow-workflows") || "{}"
      );

      const workflow = saved[workflowName.trim()];

      if (!workflow) {
        setMessage("No saved workflow found with this name.");
        return;
      }

      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);

      setMessage("Workflow loaded successfully!");
    } catch {
      setMessage("Unable to load workflow.");
    }
  };

  const clearCanvas = () => {
    setNodes([]);
    setEdges([]);
    setMessage("Canvas cleared.");
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

        <button onClick={saveWorkflow}>Save Workflow</button>
        <button onClick={loadWorkflow}>Load Workflow</button>
        <button onClick={clearCanvas}>Clear Canvas</button>
      </div>

      {message && (
        <p className="workflow-message">{message}</p>
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
