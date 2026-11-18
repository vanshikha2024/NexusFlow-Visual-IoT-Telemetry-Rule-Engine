
const API_URL =
  import.meta.env.VITE_SERVER_URL || "http://localhost:5000";

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_URL}/api/health`);

    if (!response.ok) {
      throw new Error(`Backend returned ${response.status}`);
    }

    const result = await response.json();

    return {
      connected: true,
      data: result.data ?? result,
    };
  } catch (error) {
    console.error("Backend health check failed:", error);

    return {
      connected: false,
      error: error.message,
    };
  }
}

export async function getSensorTelemetry(sensorId, options = {}) {
  const params = new URLSearchParams();

  if (options.limit) params.set("limit", options.limit);
  if (options.startTime) params.set("startTime", options.startTime);
  if (options.endTime) params.set("endTime", options.endTime);

  const query = params.toString();
  const url = `${API_URL}/api/telemetry/${encodeURIComponent(sensorId)}${query ? `?${query}` : ""}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Telemetry request failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

export async function getLatestSensorTelemetry(sensorId) {
  const response = await fetch(
    `${API_URL}/api/telemetry/${encodeURIComponent(sensorId)}/latest`
  );

  if (!response.ok) {
    throw new Error(`Latest telemetry request failed: ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

export async function getTelemetryMetrics() {
  const response = await fetch(`${API_URL}/api/telemetry/metrics`);

  if (!response.ok) {
    throw new Error(`Metrics request failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || "Unable to retrieve telemetry metrics");
  }

  return result.data;
}
// Workflow API functions

export async function createWorkflow(workflow) {
  const response = await fetch(`${API_URL}/api/workflows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(workflow),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Unable to create workflow");
  }

  return result.data;
}

export async function getWorkflows() {
  const response = await fetch(`${API_URL}/api/workflows`);

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Unable to fetch workflows");
  }

  return result.data;
}

export async function getWorkflowById(id) {
  const response = await fetch(
    `${API_URL}/api/workflows/${encodeURIComponent(id)}`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Unable to fetch workflow");
  }

  return result.data;
}

export async function updateWorkflow(id, workflow) {
  const response = await fetch(
    `${API_URL}/api/workflows/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(workflow),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Unable to update workflow");
  }

  return result.data;
}
export async function deleteWorkflow(id) {
  const response = await fetch(
    `${API_URL}/api/workflows/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Unable to delete workflow");
  }

  return result.data;
}