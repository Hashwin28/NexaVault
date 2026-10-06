import { apiRequest } from './client';

export const groupApi = {
  getMyGroup: () => apiRequest('/groups/me'),
  getGroup: (id) => apiRequest(`/groups/${id}`),
  createGroup: (name, code = null) =>
    apiRequest('/groups/', {
      method: 'POST',
      body: { name, ...(code ? { code } : {}) },
    }),
  joinGroup: (code) =>
    apiRequest('/groups/join', {
      method: 'POST',
      body: { code },
    }),
  changeCode: (id, code = null) =>
    apiRequest(`/groups/${id}/code`, {
      method: 'PATCH',
      body: { ...(code ? { code } : {}) },
    }),
  leaveGroup: (id) =>
    apiRequest(`/groups/${id}/leave`, {
      method: 'POST',
    }),
  enrollWorkspace: (id, workspaceId) =>
    apiRequest(`/groups/${id}/enroll`, {
      method: 'POST',
      body: { workspace_id: workspaceId },
    }),
};
