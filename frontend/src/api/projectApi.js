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
  getProject: (id, options = {}) => apiRequest(`/projects/${id}`, options),
  getStaffProjects: (workspaceId = null, options = {}) =>
    apiRequest(`/projects/staff/oversight${workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : ''}`, options),
  getStaffProjectOversight: (projectId, options = {}) =>
    apiRequest(`/projects/${projectId}/oversight`, options),
  getUpdates: (projectId, options = {}) => apiRequest(`/projects/${projectId}/updates`, options),
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
  getGithub: (projectId, options = {}) => apiRequest(`/projects/${projectId}/github`, options),
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
  getProgress: (projectId, options = {}) => apiRequest(`/projects/${projectId}/progress`, options),
  getReviews: (projectId, options = {}) => apiRequest(`/projects/${projectId}/reviews`, options),
};
