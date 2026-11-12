import { Handle, Position } from '@xyflow/react';

export default function CustomNode({ data, selected }) {
  const isSource = data.category === 'Data Source';
  const isAction = data.category === 'Action Trigger';
  return (
    <div className={`nf-node ${selected ? 'selected' : ''}`} style={{ borderColor: data.color }}>
      {!isSource && <Handle type="target" position={Position.Left} />}
      <div className="nf-node-cat" style={{ color: data.color }}>{data.category}</div>
      <div className="nf-node-label">{data.label}</div>
      {!isAction && <Handle type="source" position={Position.Right} />}
    </div>
  );
}