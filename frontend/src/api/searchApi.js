import { apiRequest } from './client';

export const searchApi = {
  smartSearch: (query) => apiRequest(`/search?q=${encodeURIComponent(query)}`),
};
