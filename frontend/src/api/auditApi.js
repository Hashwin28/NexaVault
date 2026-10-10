import { apiRequest } from './client';

export const auditApi = {
  /**
   * Fetches paginated activity log events with multi-criteria filtering
   */
  getActivity: (params = {}) => {
    const query = new URLSearchParams();
    if (params.workspace_id) query.set('workspace_id', params.workspace_id);
    if (params.actor_id) query.set('actor_id', params.actor_id);
    if (params.category && params.category !== 'ALL') query.set('category', params.category);
    if (params.action_type && params.action_type !== 'ALL') query.set('action_type', params.action_type);
    if (params.status && params.status !== 'ALL') query.set('status', params.status);
    if (params.time_range) query.set('time_range', params.time_range);
    if (params.start_date) query.set('start_date', params.start_date);
    if (params.end_date) query.set('end_date', params.end_date);
    if (params.search) query.set('search', params.search);
    if (params.limit) query.set('limit', params.limit);
    if (params.offset !== undefined) query.set('offset', params.offset);

    const qs = query.toString();
    return apiRequest(`/audit/activity${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetches real aggregated activity statistics for the overview cards
   */
  getStats: (params = {}) => {
    const query = new URLSearchParams();
    if (params.workspace_id) query.set('workspace_id', params.workspace_id);
    if (params.time_range) query.set('time_range', params.time_range);

    const qs = query.toString();
    return apiRequest(`/audit/stats${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetches dynamically populated filter options (workspaces, categories, actions, actors)
   */
  getFilters: () => {
    return apiRequest('/audit/filters');
  },

  /**
   * Backward-compatible audit log endpoint
   */
  getAuditLogs: (workspaceId = null) => {
    const query = workspaceId ? `?workspace_id=${workspaceId}` : '';
    return apiRequest(`/audit/logs${query}`);
  },
};
