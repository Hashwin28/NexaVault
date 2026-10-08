import { apiRequest } from './client';

export const projectApi = {
  createProject: (workspaceId, name, description = null) =>
    apiRequest('/projects/', {
      method: 'POST',
      body: { workspace_id: workspaceId, name, ...(description ? { description } : {}) },
    }),
  getProject: (id) => apiRequest(`/projects/${id}`),
  getUpdates: (projectId) => apiRequest(`/projects/${projectId}/updates`),
  postUpdate: (projectId, content, link = null) =>
    apiRequest(`/projects/${projectId}/updates`, {
      method: 'POST',
      body: { content, ...(link ? { link } : {}) },
    }),
  postComment: (projectId, updateId, content) =>
    apiRequest(`/projects/${projectId}/updates/${updateId}/comments`, {
      method: 'POST',
      body: { content },
    }),
  getGithub: (projectId) => apiRequest(`/projects/${projectId}/github`),
  linkGithub: (projectId, repoUrl) =>
    apiRequest(`/projects/${projectId}/github`, {
      method: 'POST',
      body: { repo_url: repoUrl },
    }),
  syncGithub: (projectId) =>
    apiRequest(`/projects/${projectId}/github/sync`, {
      method: 'POST',
    }),
  unlinkGithub: (projectId) =>
    apiRequest(`/projects/${projectId}/github`, {
      method: 'DELETE',
    }),
};

