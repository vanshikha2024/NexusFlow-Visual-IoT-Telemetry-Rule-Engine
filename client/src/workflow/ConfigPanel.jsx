
import { CONFIG_FIELDS } from "./nodeTypes";

export default function ConfigPanel({ node, onChange }) {
  if (!node) {
    return (
      <aside className="config-panel">
        <h3>Node Settings</h3>
        <p>Select a node on the canvas to configure it.</p>
      </aside>
    );
  }

  const fields = CONFIG_FIELDS[node.data.label] || [];
  const config = node.data.config || {};

  return (
    <aside className="config-panel">
      <h3>Node Settings</h3>
      <h4>{node.data.label}</h4>
      <p>{node.data.description}</p>

      {fields.map((field) => (
        <label className="cfg-field" key={field.key}>
          <span>{field.label}</span>

          {field.input === "select" ? (
            <select
              value={config[field.key] ?? ""}
              onChange={(event) =>
                onChange(field.key, event.target.value)
              }
            >
              <option value="">Select an option</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.input === "textarea" ? (
            <textarea
              rows={3}
              value={config[field.key] ?? ""}
              onChange={(event) =>
                onChange(field.key, event.target.value)
              }
            />
          ) : (
            <input
              type={field.input}
              min={field.input === "number" ? 1 : undefined}
              value={config[field.key] ?? ""}
              onChange={(event) =>
                onChange(
                  field.key,
                  field.input === "number" &&
                    event.target.value !== ""
                    ? Number(event.target.value)
                    : event.target.value
                )
              }
            />
          )}
        </label>
      ))}
    </aside>
  );
}
