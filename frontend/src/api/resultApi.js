import { apiRequest, API_BASE_URL } from './client';

export const resultApi = {
  getMyResults: (options = {}) => apiRequest('/results/me', options),

  correctScore: (resultEntryId, data) =>
    apiRequest(`/results/${resultEntryId}/correct`, { method: 'PATCH', body: data }),

  /**
   * Fetches the complete workspace results ledger including dynamic review rounds,
   * all enrolled groups, and individual student scores.
   */
  getWorkspaceResults: (workspaceId) =>
    apiRequest(`/results/workspace/${workspaceId}`),

  /**
   * Publishes/releases all evaluated student marks for a specific review round in a workspace.
   */
  publishRoundResults: (workspaceId, roundId) =>
    apiRequest(`/results/workspace/${workspaceId}/rounds/${roundId}/publish`, { method: 'POST' }),

  /**
   * Publishes/releases all evaluated student marks across all rounds for a workspace.
   */
  publishWorkspaceResults: (workspaceId) =>
    apiRequest(`/results/workspace/${workspaceId}/publish`, { method: 'POST' }),

  /**
   * Initiates direct download of the workspace-wide results CSV file.
   */
  exportWorkspaceResultsCsv: async (workspaceId) => {
    const token = localStorage.getItem('nexavault_jwt_token');
    const url = `${API_BASE_URL}/results/workspace/${workspaceId}/export-csv`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let errorMsg = 'Failed to download workspace results CSV.';
      try {
        const errJson = await response.json();
        if (errJson.detail) errorMsg = errJson.detail;
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    // Extract filename from Content-Disposition header if available
    let filename = `NexaVault_Results_${workspaceId}.csv`;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return filename;
  },
};
