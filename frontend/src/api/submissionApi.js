/**
 * Submission API Service
 * 
 * Provides HTTP client integration for review milestone submissions:
 * draft saving, commit SHA binding, external resource linking, and final submission.
 */

import { apiRequest } from './client';

export const submissionApi = {
  getSubmissions: (projectId) => apiRequest(`/projects/${projectId}/submissions`),
  createSubmission: (projectId, roundId, { notes = null, link = null, githubCommitSha = null, isDraft = false }) =>
    apiRequest(`/projects/${projectId}/rounds/${roundId}/submissions`, {
      method: 'POST',
      body: {
        notes,
        link,
        github_commit_sha: githubCommitSha,
        is_draft: isDraft,
      },
    }),
  updateDraft: (submissionId, { notes = null, link = null, githubCommitSha = null }) =>
    apiRequest(`/submissions/${submissionId}/draft`, {
      method: 'PATCH',
      body: {
        notes,
        link,
        github_commit_sha: githubCommitSha,
      },
    }),
  finalizeSubmit: (submissionId) =>
    apiRequest(`/submissions/${submissionId}/submit`, {
      method: 'POST',
    }),
};
