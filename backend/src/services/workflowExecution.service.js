
import {
  executionHistoryRepository,
} from "../repositories/executionHistory.repository.js";

export class WorkflowExecutionService {
  async executeWorkflow(workflow) {
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

    const results = {};
    const executionLog = [];

    const workflowId = workflow._id || workflow.id;

    const saveHistory = async (status, error = "") => {
      return executionHistoryRepository.createExecution({
        workflowId,
        workflowName: workflow.name,
        status,
        mode: "simulation",
        results,
        executionLog,
        error,
        executedAt: new Date(),
      });
    };

    try {
      if (!nodes.length) {
        throw new Error("Cannot execute an empty workflow.");
      }

      const incoming = new Set(edges.map((edge) => edge.target));

      const startNodes = nodes.filter(
        (node) => !incoming.has(node.id)
      );

      if (!startNodes.length) {
        throw new Error("Workflow has no starting node.");
      }

      const processed = new Set();

      while (processed.size < nodes.length) {
        const readyNodes = nodes.filter(
          (node) =>
            !processed.has(node.id) &&
            edges
              .filter((edge) => edge.target === node.id)
              .every((edge) => processed.has(edge.source))
        );

        if (!readyNodes.length) {
          throw new Error(
            "Workflow contains a cycle or invalid connection."
          );
        }

        for (const node of readyNodes) {
          const label = node.data?.label;
          const config = node.data?.config || {};

          const inputValues = edges
            .filter((edge) => edge.target === node.id)
            .map((edge) => results[edge.source]);

          let output;

          switch (label) {
            case "Temperature Sensor":
            case "Humidity Sensor":
              output = 65;
              break;

            case "Moving Average": {
              const values = inputValues.flat();
              const windowSize = Number(config.windowSize);

              if (!Number.isInteger(windowSize) || windowSize <= 0) {
                throw new Error(
                  "Moving Average requires a valid Window Size."
                );
              }

              const selected = values.slice(-windowSize);

              if (!selected.length) {
                throw new Error(
                  "Moving Average has no input values."
                );
              }

              output =
                selected.reduce((sum, value) => sum + value, 0) /
                selected.length;
              break;
            }

            case "Threshold Condition": {
              const value = Number(inputValues[0]);
              const threshold = Number(config.threshold);

              if (
                !Number.isFinite(value) ||
                !Number.isFinite(threshold)
              ) {
                throw new Error(
                  "Invalid threshold input or configuration."
                );
              }

              const operators = {
                ">": value > threshold,
                ">=": value >= threshold,
                "<": value < threshold,
                "<=": value <= threshold,
                "==": value === threshold,
                "!=": value !== threshold,
              };

              if (
                !Object.prototype.hasOwnProperty.call(
                  operators,
                  config.operator
                )
              ) {
                throw new Error("Invalid threshold operator.");
              }

              output = operators[config.operator];
              break;
            }

            case "SMS Alert":
              output = {
                simulated: true,
                message: config.message || "SMS simulation",
                phone: config.phone || "",
                triggered: inputValues.some(Boolean),
              };
              break;

            case "Webhook":
              output = {
                simulated: true,
                url: config.url || "",
                method: config.method || "POST",
                payload: inputValues,
              };
              break;

            default:
              throw new Error(
                `Unsupported workflow node: ${label}`
              );
          }

          results[node.id] = output;
          processed.add(node.id);

          executionLog.push({
            nodeId: node.id,
            nodeName: label,
            output,
            status: "success",
          });
        }
      }

      const executedAt = new Date();

      const history = await saveHistory("completed");

      return {
        status: "completed",
        mode: "simulation",
        results,
        executionLog,
        executedAt: executedAt.toISOString(),
        historyId: history.id,
      };
    } catch (error) {
      const failedNode = nodes.find(
        (node) => !executionLog.some(
          (entry) => entry.nodeId === node.id
        )
      );

      if (failedNode) {
        executionLog.push({
          nodeId: failedNode.id,
          nodeName: failedNode.data?.label || "Unknown Node",
          output: null,
          status: "failed",
          error: error.message,
        });
      }

      try {
        await saveHistory("failed", error.message);
      } catch (historyError) {
        console.error(
          "Failed to save execution history:",
          historyError
        );
      }

      throw error;
    }
  }
}

export const workflowExecutionService =
  new WorkflowExecutionService();

export default workflowExecutionService;
