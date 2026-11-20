import { Handle, Position } from '@xyflow/react';
import { getNodeSummary } from '../nodeTypes';

export default function CustomNode({ data, selected }) {
  const isSource = data.category === 'Data Source';
  const isAction = data.category === 'Action Trigger';
  const issues = data.issues ?? [];
  return (
    <div className={`nf-node ${selected ? 'selected' : ''}`} style={{ borderColor: issues.length ? '#f59e0b' : data.color }}>
      {!isSource && <Handle type="target" position={Position.Left} id="input" />}
      <div className="nf-node-cat" style={{ color: data.color }}>{data.category}</div>
      <div className="nf-node-label">{data.label}</div>
      {issues.length > 0 && (
        <div className="nf-node-warn" title={issues.join('\n')}>⚠ {issues.length} issue{issues.length > 1 ? 's' : ''}</div>
      )}
      <div className="nf-node-sub">{getNodeSummary(data.type, data.config)}</div>
      {!isAction && <Handle type="source" position={Position.Right} id="output" />}
    </div>
  );
}