import { apiRequest } from './client';

export const workspaceApi = {
  getMyWorkspaces: () => apiRequest('/workspaces/'),
  getWorkspace: (id) => apiRequest(`/workspaces/${id}`),
  createWorkspace: (data) => apiRequest('/workspaces/', { method: 'POST', body: data }),
  archiveWorkspace: (id) => apiRequest(`/workspaces/${id}/archive`, { method: 'PATCH' }),
  
  // Co-Staff management
  addCoStaff: (id, email) => apiRequest(`/workspaces/${id}/staff`, { method: 'POST', body: { staff_email: email } }),
  removeCoStaff: (id, staffId) => apiRequest(`/workspaces/${id}/staff/${staffId}`, { method: 'DELETE' }),
  
  // Access Requests
  getStaffRequests: (id) => apiRequest(`/workspaces/${id}/staff-requests`),
  requestAccess: (id) => apiRequest(`/workspaces/${id}/request-access`, { method: 'POST' }),
  approveStaffRequest: (id, requestId) => apiRequest(`/workspaces/${id}/staff-requests/${requestId}/approve`, { method: 'POST' }),
  rejectStaffRequest: (id, requestId) => apiRequest(`/workspaces/${id}/staff-requests/${requestId}/reject`, { method: 'POST' }),

  // Notice board
  getNotices: (id) => apiRequest(`/workspaces/${id}/notices`),
  createNotice: (id, data) => apiRequest(`/workspaces/${id}/notices`, { method: 'POST', body: data }),
  updateNotice: (id, noticeId, data) => apiRequest(`/workspaces/${id}/notices/${noticeId}`, { method: 'PATCH', body: data }),
  deleteNotice: (id, noticeId) => apiRequest(`/workspaces/${id}/notices/${noticeId}`, { method: 'DELETE' }),

  // Review rounds
  getRounds: (id) => apiRequest(`/workspaces/${id}/rounds`),
  createRound: (id, data) => apiRequest(`/workspaces/${id}/rounds`, { method: 'POST', body: data }),
  updateRound: (id, roundId, data) => apiRequest(`/workspaces/${id}/rounds/${roundId}`, { method: 'PATCH', body: data }),
  deleteRound: (id, roundId) => apiRequest(`/workspaces/${id}/rounds/${roundId}`, { method: 'DELETE' }),

  // Enrolled groups and projects inspector
  getWorkspaceGroups: (id) => apiRequest(`/workspaces/${id}/groups`),
  getWorkspaceProjects: (id) => apiRequest(`/workspaces/${id}/projects`),
};
