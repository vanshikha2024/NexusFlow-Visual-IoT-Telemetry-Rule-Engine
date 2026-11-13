import { ReactFlow, Background, useNodesState, useEdgesState } from '@xyflow/react';
import Sidebar from './components/Sidebar';
import CustomNode from './components/CustomNode';
import { NODE_LIBRARY } from './nodeTypes';

const nodeTypes = { dataSource: CustomNode, math: CustomNode, action: CustomNode };

const initialNodes = [0, 2, 4].map((i, idx) => ({
  id: `test_${idx}`,
  type: NODE_LIBRARY[i].type,
  position: { x: 100 + idx * 260, y: 150 },
  data: NODE_LIBRARY[i],
}));

export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState([]);

  return (
    <div className="app">
      <header className="topbar">NexusFlow <span>Visual IoT Rule Builder</span></header>
      <div className="main">
        <Sidebar />
        <div className="canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
          >
            <Background gap={20} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}