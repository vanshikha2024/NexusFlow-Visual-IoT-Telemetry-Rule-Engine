import { useCallback } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background,
  useNodesState, useEdgesState, useReactFlow,
} from '@xyflow/react';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';

const nodeTypes = { dataSource: CustomNode, math: CustomNode, action: CustomNode };
let idCounter = 0;
const nextId = () => `node_${++idCounter}`;

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);
  const { screenToFlowPosition } = useReactFlow();

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

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
      >
        <Background gap={20} />
      </ReactFlow>
    </div>
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