// services/api.js
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
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
