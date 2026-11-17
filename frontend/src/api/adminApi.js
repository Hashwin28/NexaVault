import { apiRequest } from './client';

export const adminApi = {
  // Dashboard
  getDashboard: () => apiRequest('/admin/dashboard'),

  // Workspaces
  getWorkspaces: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.is_archived !== undefined) q.set('is_archived', params.is_archived);
    if (params.limit) q.set('limit', params.limit);
    if (params.offset !== undefined) q.set('offset', params.offset);
    return apiRequest(`/admin/workspaces?${q.toString()}`);
  },
  getWorkspace: (id) => apiRequest(`/admin/workspaces/${id}`),
  updateWorkspace: (id, data) => apiRequest(`/admin/workspaces/${id}`, { method: 'PATCH', body: data }),
  archiveWorkspace: (id, reason) => apiRequest(`/admin/workspaces/${id}/archive`, { method: 'POST', body: { reason } }),
  unarchiveWorkspace: (id) => apiRequest(`/admin/workspaces/${id}/unarchive`, { method: 'POST' }),
  assignStaff: (workspaceId, userId) => apiRequest(`/admin/workspaces/${workspaceId}/staff`, { method: 'POST', body: { user_id: userId } }),
  removeStaff: (workspaceId, userId) => apiRequest(`/admin/workspaces/${workspaceId}/staff/${userId}`, { method: 'DELETE' }),

  // Projects
  getProjects: (params = {}) => {
    const q = new URLSearchParams();
    if (params.workspace_id) q.set('workspace_id', params.workspace_id);
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', params.limit);
    if (params.offset !== undefined) q.set('offset', params.offset);
    return apiRequest(`/admin/projects?${q.toString()}`);
  },
  getProject: (id) => apiRequest(`/admin/projects/${id}`),

  // Staff
  getStaff: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.limit) q.set('limit', params.limit);
    if (params.offset !== undefined) q.set('offset', params.offset);
    return apiRequest(`/admin/staff?${q.toString()}`);
  },
  getStaffMember: (id) => apiRequest(`/admin/staff/${id}`),

  // Students
  getStudents: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.workspace_id) q.set('workspace_id', params.workspace_id);
    if (params.limit) q.set('limit', params.limit);
    if (params.offset !== undefined) q.set('offset', params.offset);
    return apiRequest(`/admin/students?${q.toString()}`);
  },
  getStudent: (id) => apiRequest(`/admin/students/${id}`),

  // User status
  updateUserStatus: (userId, isActive, reason) =>
    apiRequest(`/admin/users/${userId}/status`, { method: 'PATCH', body: { is_active: isActive, reason } }),

  // Audit
  getAudit: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') q.set(k, v); });
    return apiRequest(`/admin/audit?${q.toString()}`);
  },
  getAuditStats: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
    return apiRequest(`/admin/audit/stats?${q.toString()}`);
  },
  getAuditFilters: () => apiRequest('/admin/audit/filters'),

  // Reports
  getReports: () => apiRequest('/admin/reports/overview'),
};
