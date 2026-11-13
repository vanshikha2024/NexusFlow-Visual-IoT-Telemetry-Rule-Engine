import { NODE_LIBRARY } from '../nodeTypes';

export default function Sidebar() {
  const onDragStart = (e, node) => {
    e.dataTransfer.setData('application/nexusflow', JSON.stringify(node));
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <h2>Node Library</h2>
      <p className="hint">Drag a node onto the canvas</p>
      {NODE_LIBRARY.map((n) => (
        <div
          key={n.label}
          className="palette-item"
          style={{ borderLeftColor: n.color }}
          draggable
          onDragStart={(e) => onDragStart(e, n)}
        >
          <small>{n.category}</small>
          <div>{n.label}</div>
        </div>
      ))}
    </aside>
  );
}