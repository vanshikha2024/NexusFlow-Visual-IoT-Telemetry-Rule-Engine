export default function OpenDialog({ items, loading, onLoad, onDelete, onClose }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>Saved workflows</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
        {loading && <p className="hint">Loading…</p>}
        {!loading && items.length === 0 && <p className="hint">No saved workflows yet.</p>}
        <ul className="wf-list">
          {items.map((w) => {
            const id = w.id ?? w._id;
            return (
              <li key={id}>
                <div>
                  <strong>{w.name}</strong>
                  <small>v{w.version ?? 1} · {w.updatedAt ? new Date(w.updatedAt).toLocaleString() : ''}</small>
                </div>
                <div className="wf-actions">
                  <button onClick={() => onLoad(id)}>Open</button>
                  <button className="danger" onClick={() => onDelete(id)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}