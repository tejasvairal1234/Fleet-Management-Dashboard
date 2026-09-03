// services/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (netErr) {
    const connErr = new Error("Unable to connect to simulator");
    connErr.isConnectionError = true;
    connErr.originalError = netErr;
    throw connErr;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let msg = "";
    if (body.messages && Array.isArray(body.messages) && body.messages.length > 0) {
      msg = body.messages.join(", ");
    } else if (body.message) {
      msg = body.message;
    } else if (body.error && typeof body.error === "string") {
      msg = body.error;
    } else {
      msg = `HTTP ${res.status}: ${res.statusText || "Request failed"}`;
    }
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

export const api = {
  health: ()                   => request("/api/health"),
  getRobots: ()                => request("/api/robots"),
  getRobot: (id)               => request(`/api/robots/${id}`),
  getSimulatorConfig: ()       => request("/api/simulator/config"),
  updateSimulatorConfig: (data, adminKey) =>
    request("/api/simulator/config", {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "X-Admin-Key": adminKey },
    }),
};
