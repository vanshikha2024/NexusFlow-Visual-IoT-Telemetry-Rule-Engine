import {
  executionHistoryRepository,
} from "../repositories/executionHistory.repository.js";

import { validateGraph } from "../graph/index.js";
import { ApiError } from "../utils/apiError.js";
import { telemetryService } from "./telemetry.service.js";
import { webhookService } from "./webhook.service.js";
import { telegramService } from "./telegram.service.js";

export class WorkflowExecutionService {
  async executeWorkflow(workflow) {
    const nodes = workflow.nodes || [];
    const edges = workflow.edges || [];

   const results = {};
   const executionLog = [];

   let hasLiveActions = false;
  let hasSimulatedActions = false;

  const getExecutionMode = () => {
    if (hasLiveActions && hasSimulatedActions) return "mixed";
    if (hasLiveActions) return "live";
    return "simulation";
  };

    const workflowId = workflow._id || workflow.id;

    const saveHistory = async (status, error = "") => {
      return executionHistoryRepository.createExecution({
        workflowId,
        workflowName: workflow.name,
        status,
        mode: getExecutionMode(),
        results,
        executionLog,
        error,
        executedAt: new Date(),
      });
    };

    try {
      // Validate the complete graph before executing any node.
      const validation = validateGraph({ nodes, edges });

      if (!validation.isValid) {
        const messages = validation.errors.map(
          (item) => item.message
        );

        throw ApiError.badRequest(
          `Workflow graph validation failed: ${messages.join("; ")}`,
          validation.errors
        );
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
          const label =
            node.data?.label ||
            node.label ||
            node.type;

          // Support both old top-level and newer nested configurations.
          const config = {
            ...(node.config || {}),
            ...(node.data?.config || {}),
          };

          const normalizedLabel = label.trim().toLowerCase();

          const inputValues = edges
            .filter((edge) => edge.target === node.id)
            .map((edge) => results[edge.source]);

          let output;
          let telemetryDetails = null;

          switch (normalizedLabel) {
            case "temperature sensor":
            case "humidity sensor":
            case "turbine sensor":{
            const sensorId = config.sensorId;

            if (!sensorId) {
              throw ApiError.badRequest(
                `${label} requires a configured sensor ID.`
              );
            }

            const telemetry =
              await telemetryService.getLatestTelemetry(sensorId);

            if (!telemetry) {
              throw ApiError.notFound(
                `No telemetry records found for sensor "${sensorId}".`
              );
            }

            if (
              typeof telemetry.value !== "number" ||
              !Number.isFinite(telemetry.value)
            ) {
              throw ApiError.badRequest(
                `Invalid telemetry value received from sensor "${sensorId}".`
              );
            }

            output = telemetry.value;

            telemetryDetails = {
              sensorId,
              timestamp: telemetry.timestamp,
              unit: telemetry.unit || null,
              telemetryId: telemetry._id?.toString?.() || null,
            };

           break;
          }

            case "moving average": {
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

            case "threshold":
            case "threshold condition": {
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

            case "sms alert":
            case "sms":
              hasSimulatedActions = true;
              output = {
                simulated: true,
                message: config.message || "SMS simulation",
                phone: config.phone || config.recipient || "",
                triggered: inputValues.some(Boolean),
              };
              break;

            case "telegram alert": {
              const triggered = inputValues.some(Boolean);

              if (!triggered) {
                output = {
                  delivered: false,
                  skipped: true,
                  reason: "No upstream condition was true.",
                };
                break;
              }

              const message = config.message?.trim();

              if (!message) {
                throw ApiError.badRequest(
                  "Telegram Alert requires a message."
                );
              }

              hasLiveActions = true;

              const notification = [
                `🚨 NexusFlow IoT Alert`,
                "",
                message,
                "",
                `Workflow: ${workflow.name}`,
                `Inputs: ${JSON.stringify(inputValues)}`,
                `Time: ${new Date().toISOString()}`,
              ].join("\n");

              output = await telegramService.sendMessage(notification);

              break;
}

            case "webhook": {
              const triggered = inputValues.some(Boolean);

              if (!triggered) {
                output = {
                  delivered: false,
                  skipped: true,
                  reason: "No upstream condition was true.",
                };
                break;
              }

              if (!config.url) {
                throw ApiError.badRequest(
                  "Webhook requires a configured URL."
                );
              }

              hasLiveActions = true;

              const payload = {
                workflowId: workflowId.toString(),
                workflowName: workflow.name,
                nodeId: node.id,
                nodeName: label,
                triggeredAt: new Date().toISOString(),
                inputs: inputValues,
              };

              output = await webhookService.sendWebhook({
                url: config.url,
                method: config.method || "POST",
                payload,
              });

              break;
            }

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
  ...(telemetryDetails ? { telemetry: telemetryDetails } : {}),
});
        }
      }

      const executedAt = new Date();
      const history = await saveHistory("completed");

      return {
        status: "completed",
        mode: getExecutionMode(),
        results,
        executionLog,
        executedAt: executedAt.toISOString(),
        historyId: history.id,
      };
    } catch (error) {
      const failedNode = nodes.find(
        (node) =>
          !executionLog.some(
            (entry) => entry.nodeId === node.id
          )
      );

      if (failedNode) {
        executionLog.push({
          nodeId: failedNode.id,
          nodeName:
            failedNode.data?.label ||
            failedNode.label ||
            failedNode.type ||
            "Unknown Node",
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