import { apiRequest } from './client';

export const reviewApi = {
  getQueue: (statusFilter) => apiRequest(statusFilter ? `/reviews/queue?status_filter=${statusFilter}` : '/reviews/queue'),
  claimSubmission: (versionId) => apiRequest(`/reviews/${versionId}/claim`, { method: 'POST' }),
  releaseClaim: (versionId) => apiRequest(`/reviews/${versionId}/release-claim`, { method: 'POST' }),
  evaluateSubmission: (versionId, data) => 
    apiRequest(`/reviews/${versionId}/evaluate`, { method: 'POST', body: data }),
  releaseResults: (versionId) => apiRequest(`/reviews/${versionId}/release-results`, { method: 'POST' }),
};
