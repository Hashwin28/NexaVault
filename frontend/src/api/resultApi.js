import { apiRequest } from './client';

export const resultApi = {
  getMyResults: () => apiRequest('/results/me'),
};
