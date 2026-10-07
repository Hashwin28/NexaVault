import { apiRequest } from './client';

export const resultApi = {
  getMyResults: () => apiRequest('/results/me'),
  correctScore: (resultEntryId, data) =>
    apiRequest(`/results/${resultEntryId}/correct`, { method: 'PATCH', body: data }),
};
