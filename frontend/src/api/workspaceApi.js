import { apiRequest } from './client';

export const workspaceApi = {
  getMyWorkspaces: () => apiRequest('/workspaces/'),
  getWorkspace: (id) => apiRequest(`/workspaces/${id}`),
  getNotices: (id) => apiRequest(`/workspaces/${id}/notices`),
  getRounds: (id) => apiRequest(`/workspaces/${id}/rounds`),
};
