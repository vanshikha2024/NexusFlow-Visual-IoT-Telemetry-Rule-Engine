
import { useEffect, useState } from "react";
import {
  RefreshCw,
  History,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  X,
} from "lucide-react";

const API_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

function ExecutionHistory() {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/execution-history`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load execution history."
        );
      }

      setExecutions(result.data?.executions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (executionId) => {
    try {
      setDetailLoading(true);
      setDetailError("");
      setSelectedExecution(null);

      const response = await fetch(
        `${API_URL}/api/execution-history/${encodeURIComponent(executionId)}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load execution details."
        );
      }

      setSelectedExecution(result.data);
    } catch (err) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <section className="execution-history">
      <div className="history-header">
        <div>
          <h2>Execution History</h2>
          <p>Track previous workflow executions and results.</p>
        </div>

        <button
          className="primary-button"
          onClick={fetchHistory}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <p>Loading execution history...</p>
      ) : error ? (
        <p className="history-error">{error}</p>
      ) : executions.length === 0 ? (
        <div className="history-empty">
          <History size={40} />
          <h3>No executions yet</h3>
          <p>Run a workflow to see its execution history here.</p>
        </div>
      ) : (
        <div className="history-list">
          {executions.map((execution) => (
            <article className="history-card" key={execution._id}>
              <div className="history-card-top">
                <div>
                  <h3>{execution.workflowName}</h3>
                  <span className="history-id">
                    ID: {execution._id}
                  </span>
                </div>

                <span className={`history-status ${execution.status}`}>
                  {execution.status === "completed" ? (
                    <CheckCircle size={15} />
                  ) : (
                    <XCircle size={15} />
                  )}
                  {execution.status}
                </span>
              </div>

              <div className="history-meta">
                <span>
                  <Clock size={15} />
                  {new Date(execution.executedAt).toLocaleString()}
                </span>

                <span>Mode: {execution.mode}</span>

                <span>
                  Nodes: {execution.executionLog?.length || 0}
                </span>
              </div>

              <div className="history-nodes">
                {execution.executionLog?.map((node, index) => (
                  <div key={`${node.nodeId}-${index}`}>
                    <span>{node.nodeName}</span>
                    <span className={node.status}>{node.status}</span>
                  </div>
                ))}
              </div>

              <button
                className="history-details-button"
                onClick={() => viewDetails(execution._id)}
              >
                <Eye size={16} />
                View Details
              </button>
            </article>
          ))}
        </div>
      )}

      {(detailLoading || detailError || selectedExecution) && (
        <div className="execution-modal-overlay">
          <div className="execution-modal">
            <div className="execution-modal-header">
              <h2>Execution Details</h2>

              <button
                className="execution-modal-close"
                onClick={() => {
                  setSelectedExecution(null);
                  setDetailError("");
                }}
                aria-label="Close details"
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <p>Loading execution details...</p>
            ) : detailError ? (
              <p className="history-error">{detailError}</p>
            ) : selectedExecution ? (
              <>
                <div className="execution-detail-summary">
                  <h3>{selectedExecution.workflowName}</h3>
                  <p>
                    Status: {selectedExecution.status}
                  </p>
                  <p>
                    Mode: {selectedExecution.mode}
                  </p>
                  <p>
                    Executed:{" "}
                    {new Date(
                      selectedExecution.executedAt
                    ).toLocaleString()}
                  </p>
                  {selectedExecution.error && (
                    <p className="history-error">
                      Error: {selectedExecution.error}
                    </p>
                  )}
                </div>

                <h3>Node Execution Results</h3>

                <div className="execution-detail-nodes">
                  {selectedExecution.executionLog?.map(
                    (node, index) => (
                      <article
                        className="execution-detail-node"
                        key={`${node.nodeId}-${index}`}
                      >
                        <div className="history-card-top">
                          <h4>{node.nodeName}</h4>
                          <span className={node.status}>
                            {node.status}
                          </span>
                        </div>

                        <p>
                          <strong>Node ID:</strong> {node.nodeId}
                        </p>

                        <p><strong>Output:</strong></p>

                        <pre>
                          {JSON.stringify(node.output, null, 2)}
                        </pre>

                        {node.error && (
                          <p className="history-error">
                            {node.error}
                          </p>
                        )}
                      </article>
                    )
                  )}
                </div>

                <h3>Complete Workflow Results</h3>
                <pre className="execution-results-json">
                  {JSON.stringify(
                    selectedExecution.results,
                    null,
                    2
                  )}
                </pre>
              </>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

export default ExecutionHistory;
