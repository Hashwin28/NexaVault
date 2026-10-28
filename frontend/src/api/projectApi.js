/**
 * Project API Service
 * 
 * Provides HTTP client integration for project workspace lifecycle:
 * project creation, status updates, collaborative comments, and GitHub repository sync.
 */

import { apiRequest } from './client';

export const projectApi = {
  createProject: (workspaceId, name, description = null) =>
    apiRequest('/projects/', {
      method: 'POST',
      body: { workspace_id: workspaceId, name, ...(description ? { description } : {}) },
    }),
  getProject: (id) => apiRequest(`/projects/${id}`),
  getUpdates: (projectId) => apiRequest(`/projects/${projectId}/updates`),
  postUpdate: (projectId, contentOrObj, link = null) => {
    let body = {};
    if (typeof contentOrObj === 'object' && contentOrObj !== null) {
      body = {
        content: contentOrObj.content,
        ...(contentOrObj.link ? { link: contentOrObj.link } : {}),
      };
    } else {
      body = {
        content: contentOrObj,
        ...(link ? { link } : {}),
      };
    }
    return apiRequest(`/projects/${projectId}/updates`, {
      method: 'POST',
      body,
    });
  },
  postComment: (projectId, updateId, contentOrObj) => {
    const content = (typeof contentOrObj === 'object' && contentOrObj !== null)
      ? contentOrObj.content
      : contentOrObj;
    return apiRequest(`/projects/${projectId}/updates/${updateId}/comments`, {
      method: 'POST',
      body: { content },
    });
  },
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

