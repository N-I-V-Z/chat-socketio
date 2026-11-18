import api from "../../shared/api/client";

export async function listAdminUsers() {
  const response = await api.get("/api/v1/admin/users");
  return response.data.data;
}

export async function getAuditLogs(page, pageSize, eventType) {
  const response = await api.get("/api/v1/admin/logs", {
    params: { page, pageSize, ...(eventType ? { eventType } : {}) },
  });
  return response.data.data;
}
