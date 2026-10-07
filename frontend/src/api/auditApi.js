import { apiRequest } from './client';

export const auditApi = {
  getAuditLogs: (workspaceId = null) => {
    const query = workspaceId ? `?workspace_id=${workspaceId}` : '';
    return apiRequest(`/audit/logs${query}`);
  },
};
