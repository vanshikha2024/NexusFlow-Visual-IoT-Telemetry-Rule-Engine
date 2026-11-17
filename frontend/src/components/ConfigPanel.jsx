import { CONFIG_FIELDS } from '../nodeTypes';

export default function ConfigPanel({ node, onChange }) {
  if (!node) {
    return (
      <aside className="config-panel">
        <h3>Node Settings</h3>
        <p className="hint">Click a node on the canvas to edit its settings.</p>
      </aside>
    );
  }

  const fields = CONFIG_FIELDS[node.type] ?? [];
  const config = node.data.config ?? {};

  return (
    <aside className="config-panel">
      <h3>{node.data.label}</h3>
      <p className="hint">{node.data.category} · {node.id}</p>

      {fields.map((f) => (
        <label key={f.key} className="cfg-field">
          <span>{f.label}</span>
          {f.input === 'select' ? (
            <select value={config[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)}>
              {f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : f.input === 'textarea' ? (
            <textarea rows={3} value={config[f.key] ?? ''} onChange={(e) => onChange(f.key, e.target.value)} />
          ) : (
            <input
              type={f.input}
              value={config[f.key] ?? ''}
              onChange={(e) =>
                onChange(f.key, f.input === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)
              }
            />
          )}
        </label>
      ))}
    </aside>
  );
}