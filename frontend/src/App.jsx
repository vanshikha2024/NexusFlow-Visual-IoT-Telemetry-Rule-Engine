import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import ConfigPanel from './components/ConfigPanel';
import { serializeGraph } from './utils/serialize';
import { connectionError, validateWorkflow } from './utils/validate';

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
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const { screenToFlowPosition, getNodes, getEdges } = useReactFlow();

  // Validation runs on every change so the user gets live feedback.
  const validation = useMemo(
    () => validateWorkflow(nodes, edges, workflowName),
    [nodes, edges, workflowName]
  );
  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, issues: validation.byNode[n.id] ?? [] } })),
    [nodes, validation]
  );
  const selectedNode = displayNodes.find((n) => n.id === selectedId) ?? null;

  const flash = (type, text) => {
    setNotice({ type, text });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  };

  const isValidConnection = useCallback(
    (conn) => !connectionError(conn, getNodes(), getEdges()),
    [getNodes, getEdges]
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  // When a drag ends on a node but the connection is not allowed, explain why.
  const onConnectEnd = useCallback((_, state) => {
    if (!state.toNode || state.isValid !== false) return;
    const fromIsSource = state.fromHandle?.type !== 'target';
    const conn = fromIsSource
      ? { source: state.fromNode.id, target: state.toNode.id }
      : { source: state.toNode.id, target: state.fromNode.id };
    const msg = connectionError(conn, getNodes(), getEdges());
    if (msg) flash('error', msg);
  }, [getNodes, getEdges]);

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
    if (validation.total > 0) {
      const first = validation.workflow[0] ?? Object.values(validation.byNode)[0][0];
      flash('error', `Fix ${validation.total} issue${validation.total > 1 ? 's' : ''} before saving. ${first}`);
      return;
    }
    const json = serializeGraph(nodes, edges, workflowName);
    const text = JSON.stringify(json, null, 2);
    console.log(text);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'nexusflow-workflow.json';
    a.click();
    flash('success', 'Workflow saved as JSON.');
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
        <span className={`badge ${validation.total ? 'warn' : 'ok'}`}>
          {validation.total ? `⚠ ${validation.total} issue${validation.total > 1 ? 's' : ''}` : '✓ Valid'}
        </span>
        <button onClick={saveGraph}>Save JSON</button>
        <button className="secondary" onClick={clearGraph}>Clear</button>
      </div>
      {notice && <div className={`notice ${notice.type}`}>{notice.text}</div>}
      <ReactFlow
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
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
    <ConfigPanel
      node={selectedNode}
      issues={selectedNode?.data.issues}
      onChange={updateConfig}
      onDelete={deleteSelected}
    />
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