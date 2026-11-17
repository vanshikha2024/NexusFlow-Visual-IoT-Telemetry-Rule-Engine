
import { nodeLibrary } from "./nodeTypes";

export default function Sidebar() {
  const onDragStart = (event, node) => {
    event.dataTransfer.setData(
      "application/nexusflow",
      JSON.stringify(node)
    );

    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="workflow-sidebar">
      <h2>Node Library</h2>
      <p className="workflow-hint">
        Drag a node onto the canvas
      </p>

      {nodeLibrary.map((node) => (
        <div
          key={node.label}
          className="workflow-palette-item"
          style={{ borderLeftColor: node.color }}
          draggable
          onDragStart={(event) => onDragStart(event, node)}
        >
          <small>{node.category}</small>
          <div>{node.label}</div>
          <p>{node.description}</p>
        </div>
      ))}
    </aside>
  );
}
