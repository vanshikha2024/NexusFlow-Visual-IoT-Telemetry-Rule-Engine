import { useCallback, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import ConfigPanel from './components/ConfigPanel';
import { serializeGraph } from './utils/serialize';

const nodeTypes = {
  turbineSensor: CustomNode,
  temperatureSensor: CustomNode,
  movingAverage: CustomNode,
  threshold: CustomNode,
  smsAlert: CustomNode,
  webhook: CustomNode,
};
let idCounter = 0;
const nextId = () => `node-${++idCounter}`;

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [selectedId, setSelectedId] = useState(null);
  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const { screenToFlowPosition } = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/nexusflow');
    if (!raw) return;
    const item = JSON.parse(raw);
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setNodes((nds) => nds.concat({ id: nextId(), type: item.type, position, data: item }));
  }, [screenToFlowPosition, setNodes]);

  const updateConfig = (key, value) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, [key]: value } } }
          : n
      )
    );
  };
  const deleteSelected = () => {
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  };
  const saveGraph = () => {
    const json = serializeGraph(nodes, edges, workflowName);
    const text = JSON.stringify(json, null, 2);
    console.log(text);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'nexusflow-workflow.json';
    a.click();
  };

  const clearGraph = () => { setNodes([]); setEdges([]); setSelectedId(null); };

  return (
    <>
    <div className="canvas">
      <div className="toolbar">
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          placeholder="Workflow name"
        />
        <button onClick={saveGraph}>Save JSON</button>
        <button className="secondary" onClick={clearGraph}>Clear</button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onPaneClick={() => setSelectedId(null)}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
      >
        <Background gap={20} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
        <ConfigPanel node={selectedNode} onChange={updateConfig} onDelete={deleteSelected} />
    </>
  );
}

export default function App() {
  return (
    <div className="app">
      <header className="topbar">NexusFlow <span>Visual IoT Rule Builder</span></header>
      <div className="main">
        <ReactFlowProvider>
          <Sidebar />
          <Canvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}