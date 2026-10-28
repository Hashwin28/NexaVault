import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  GitPullRequest, 
  Users, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Star, 
  GitFork, 
  Bug, 
  Settings, 
  Unlink, 
  CheckCircle2 
} from 'lucide-react';

/**
 * Extracts owner and repo from various GitHub URL formats:
 * - https://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(url) {
  if (!url) return null;
  const clean = url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^github\.com\//, '').replace(/\/$/, '');
  const parts = clean.split('/');
  if (parts.length >= 2) {
    return {
      owner: parts[0],
      repo: parts[1].replace(/\.git$/, ''),
      full: `${parts[0]}/${parts[1].replace(/\.git$/, '')}`,
      url: `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/, '')}`
    };
  }
  return null;
}

export default function GitHubRepoDashboard({
  repoUrl,
  onLinkRepo,
  onUnlinkRepo,
  onSyncRepo,
  syncedCommits = [],
  lastSyncedAt = null,
  linking = false,
  readOnly = false,
  projectMembers = []
}) {
  const [activeTab, setActiveTab] = useState('commits'); // 'commits', 'contributors', 'pulls', 'issues'
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState(repoUrl || '');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [syncingServer, setSyncingServer] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [repoDetails, setRepoDetails] = useState(null);
  const [commits, setCommits] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [pulls, setPulls] = useState([]);
  const [issues, setIssues] = useState([]);

  const parsed = parseGitHubUrl(repoUrl);

  useEffect(() => {
    if (parsed) {
      fetchGitHubData(parsed.owner, parsed.repo);
    } else {
      setRepoDetails(null);
      setCommits([]);
      setContributors([]);
      setPulls([]);
      setIssues([]);
      setRateLimited(false);
    }
  }, [repoUrl]);

  // Sync state if syncedCommits prop updates and direct fetch is empty
  useEffect(() => {
    if (syncedCommits && syncedCommits.length > 0 && commits.length === 0) {
      const formatted = syncedCommits.map((c) => ({
        sha: c.commit_sha,
        commit: {
          message: c.commit_message,
          author: { name: c.author_name, date: c.committed_at }
        },
        author: { login: c.author_name }
      }));
      setCommits(formatted);
    }
  }, [syncedCommits]);

  const fetchGitHubData = async (owner, repo) => {
    setLoadingDetails(true);
    setRateLimited(false);
    const headers = { Accept: 'application/vnd.github.v3+json' };

    try {
      // 1. Fetch Repository Details
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers }).catch(() => null);
      if (repoRes && repoRes.ok) {
        const data = await repoRes.json();
        setRepoDetails(data);
      } else if (repoRes && repoRes.status === 403) {
        setRateLimited(true);
      }

      // 2. Fetch Commits
      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=15`, { headers }).catch(() => null);
      if (commitRes && commitRes.ok) {
        const cmData = await commitRes.json();
        if (Array.isArray(cmData)) setCommits(cmData);
      } else if (syncedCommits && syncedCommits.length > 0) {
        const formatted = syncedCommits.map((c) => ({
          sha: c.commit_sha,
          commit: {
            message: c.commit_message,
            author: { name: c.author_name, date: c.committed_at }
          },
          author: { login: c.author_name }
        }));
        setCommits(formatted);
      }

      // 3. Fetch Contributors
      const contribRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=15`, { headers }).catch(() => null);
      if (contribRes && contribRes.ok) {
        const cData = await contribRes.json();
        if (Array.isArray(cData)) setContributors(cData);
      } else if (contribRes && contribRes.status === 403) {
        setRateLimited(true);
      }

      // 4. Fetch Pull Requests
      const pullsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10`, { headers }).catch(() => null);
      if (pullsRes && pullsRes.ok) {
        const pData = await pullsRes.json();
        if (Array.isArray(pData)) setPulls(pData);
      }

      // 5. Fetch Issues
      const issuesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=10`, { headers }).catch(() => null);
      if (issuesRes && issuesRes.ok) {
        const iData = await issuesRes.json();
        if (Array.isArray(iData)) setIssues(iData.filter((item) => !item.pull_request));
      }

    } catch (err) {
      console.warn('Direct GitHub API fetch warning:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleManualSync = async () => {
    if (onSyncRepo) {
      setSyncingServer(true);
      try {
        await onSyncRepo();
      } catch (err) {
        console.error('Failed to sync server repository commits:', err);
      } finally {
        setSyncingServer(false);
      }
    }
    if (parsed) {
      await fetchGitHubData(parsed.owner, parsed.repo);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    onLinkRepo(inputUrl.trim());
    setIsEditing(false);
  };

  // If no repository is linked yet and not editing
  if (!parsed && !isEditing) {
    return (
      <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
          <GitBranch size={24} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">No GitHub Repository Connected</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Connect your project codebase to monitor real-time commits, verify deliverable milestones, and track peer contributions.
          </p>
        </div>

        {!readOnly && (
          <form onSubmit={handleFormSubmit} className="max-w-md mx-auto flex gap-2 pt-2">
            <input
              type="text"
              placeholder="e.g. https://github.com/owner/repo"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              required
              className="flex-1 px-3 py-2 rounded-lg bg-vault-canvas border border-vault-border text-white text-xs font-mono focus:outline-none focus:border-teal-500/60"
            />
            <button
              type="submit"
              disabled={linking || !inputUrl.trim()}
              className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-colors"
            >
              {linking ? 'Connecting...' : 'Connect Repository'}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-vault-surface border border-vault-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <GitBranch size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">GitHub Repository</h3>
            <p className="text-xs text-slate-400">
              Track codebase activity, commits, contributors, issues, and pull requests directly in NexaVault.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {parsed && (
            <button
              onClick={handleManualSync}
              disabled={loadingDetails || syncingServer}
              className="px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:text-teal-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw size={13} className={loadingDetails || syncingServer ? 'animate-spin' : ''} />
              <span>{loadingDetails || syncingServer ? 'Syncing...' : 'Sync Live'}</span>
            </button>
          )}

          {parsed && (
            <a
              href={parsed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-vault-canvas hover:bg-vault-canvas/80 border border-vault-border text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink size={13} />
              <span>View on GitHub</span>
            </a>
          )}

          {!readOnly && (
            <>
              <button
                onClick={() => {
                  setInputUrl(parsed?.url || '');
                  setIsEditing(!isEditing);
                }}
                className="px-3 py-1.5 rounded-lg bg-vault-canvas hover:bg-vault-canvas/80 border border-vault-border text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Settings size={13} />
                <span>Change</span>
              </button>

              <button
                onClick={onUnlinkRepo}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Unlink size={13} />
                <span>Disconnect</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editing Form when Change Repo is clicked */}
      {isEditing && (
        <form onSubmit={handleFormSubmit} className="p-4 rounded-xl bg-vault-canvas border border-teal-500/40 flex gap-2">
          <input
            type="text"
            placeholder="e.g. https://github.com/owner/repo"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            required
            className="flex-1 px-3 py-2 rounded-lg bg-vault-surface border border-vault-border text-white text-xs font-mono focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            disabled={linking || !inputUrl.trim()}
            className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs"
          >
            {linking ? 'Updating...' : 'Save Repo'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-2 rounded-lg bg-vault-surface border border-vault-border text-slate-400 text-xs"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Connected Banner */}
      {parsed && (
        <div className="px-4 py-2.5 rounded-lg bg-[#E6F4EA] dark:bg-[#1E3A2F] border border-[#A8DAB5] dark:border-[#2D5A47] text-[#137333] dark:text-[#81C995] text-xs font-semibold flex items-center justify-between gap-2 font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} />
            <span>Connected repository: {parsed.full}</span>
          </div>
          {lastSyncedAt && (
            <span className="text-[11px] opacity-80 font-normal">
              Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}

      {rateLimited && (
        <div className="px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>GitHub client unauthenticated rate limit reached. Displaying latest synced data from NexaVault backend.</span>
        </div>
      )}

      {/* Main Repository Card */}
      {parsed && (
        <div className="p-6 rounded-2xl bg-vault-surface border border-vault-border space-y-5">
          {/* Title & Badges */}
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-teal-400 font-mono tracking-tight">
              {parsed.owner} / {parsed.repo}
            </h2>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-medium flex items-center gap-1.5">
                <span>💻</span> {repoDetails?.language || 'Repository'}
              </span>

              {repoDetails?.stargazers_count !== undefined && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-1.5">
                  <Star size={12} className="text-amber-400 fill-amber-400/40" /> {repoDetails.stargazers_count} stars
                </span>
              )}

              {repoDetails?.forks_count !== undefined && (
                <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium flex items-center gap-1.5">
                  <GitFork size={12} /> {repoDetails.forks_count} forks
                </span>
              )}

              {repoDetails?.open_issues_count !== undefined && (
                <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1.5">
                  <Bug size={12} /> {repoDetails.open_issues_count} open issues
                </span>
              )}

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center gap-1.5 font-mono">
                <span>🌿</span> Branch: {repoDetails?.default_branch || 'main'}
              </span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 border-b border-vault-border/60 pt-2 overflow-x-auto">
            {[
              { id: 'commits', label: 'Recent Commits', icon: GitCommit, count: commits.length },
              { id: 'contributors', label: 'Contributors', icon: Users, count: contributors.length },
              { id: 'pulls', label: 'Pull Requests', icon: GitPullRequest, count: pulls.length },
              { id: 'issues', label: 'Issues', icon: Bug, count: issues.length },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all flex items-center gap-2 whitespace-nowrap outline-none ${
                    activeTab === tab.id
                      ? 'text-teal-300 border-b-2 border-teal-400 bg-teal-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-vault-canvas/50'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-vault-canvas border border-vault-border">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT */}

          {/* 1. Recent Commits */}
          {activeTab === 'commits' && (
            <div className="space-y-3">
              {commits.length === 0 ? (
                <div className="text-center py-6 text-slate-400 space-y-2">
                  <GitCommit size={24} className="mx-auto text-slate-500" />
                  <p className="text-xs">No commit records available yet for this repository.</p>
                  <button
                    onClick={handleManualSync}
                    className="text-xs text-teal-400 hover:underline"
                  >
                    Click to sync live commits now
                  </button>
                </div>
              ) : (
                commits.map((c, idx) => (
                  <div
                    key={c.sha || idx}
                    className="p-3.5 rounded-xl bg-vault-canvas border border-vault-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      {c.author?.avatar_url ? (
                        <img
                          src={c.author.avatar_url}
                          alt={c.author.login || 'Avatar'}
                          className="w-7 h-7 rounded-full border border-vault-border"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-teal-400 font-mono font-bold">
                          {(c.author?.login || c.commit?.author?.name || 'G')[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium text-slate-200">{c.commit?.message || 'Code commit'}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {c.author?.login || c.commit?.author?.name || 'Contributor'} committed on{' '}
                          {c.commit?.author?.date ? new Date(c.commit.author.date).toLocaleDateString() : 'recent'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-700 text-teal-400">
                        {c.sha?.slice(0, 7) || 'HEAD'}
                      </span>
                      {c.html_url && (
                        <a
                          href={c.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-white p-1"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. Contributors */}
          {activeTab === 'contributors' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {contributors.length === 0 ? (
                <div className="text-center py-6 text-slate-400 space-y-2 col-span-full">
                  <Users size={24} className="mx-auto text-slate-500" />
                  <p className="text-xs">No public contributor stats available from GitHub API for this repository.</p>
                </div>
              ) : (
                contributors.map((contrib) => (
                  <div
                    key={contrib.id || contrib.login}
                    className="p-3.5 rounded-xl bg-vault-canvas border border-vault-border flex items-center gap-3"
                  >
                    <img
                      src={contrib.avatar_url || `https://avatars.githubusercontent.com/${contrib.login}`}
                      alt={contrib.login}
                      className="w-10 h-10 rounded-full border border-vault-border bg-slate-800"
                    />
                    <div className="min-w-0 flex-1">
                      <a
                        href={contrib.html_url || `https://github.com/${contrib.login}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-slate-200 hover:text-teal-400 truncate block font-mono"
                      >
                        {contrib.login}
                      </a>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {contrib.contributions} contributions
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 3. Pull Requests */}
          {activeTab === 'pulls' && (
            <div className="space-y-3">
              {pulls.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No open or recent pull requests found.</p>
              ) : (
                pulls.map((pr) => (
                  <div
                    key={pr.id}
                    className="p-3.5 rounded-xl bg-vault-canvas border border-vault-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <GitPullRequest size={16} className={pr.state === 'open' ? 'text-emerald-400' : 'text-purple-400'} />
                      <div>
                        <a
                          href={pr.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-slate-200 hover:text-teal-400"
                        >
                          {pr.title} <span className="font-mono text-slate-500">#{pr.number}</span>
                        </a>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Opened by {pr.user?.login} on {new Date(pr.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      pr.state === 'open' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30' : 'bg-purple-950 text-purple-400 border border-purple-500/30'
                    }`}>
                      {pr.state}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 4. Issues */}
          {activeTab === 'issues' && (
            <div className="space-y-3">
              {issues.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No open issues found.</p>
              ) : (
                issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3.5 rounded-xl bg-vault-canvas border border-vault-border flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <Bug size={16} className={issue.state === 'open' ? 'text-rose-400' : 'text-slate-400'} />
                      <div>
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-slate-200 hover:text-teal-400"
                        >
                          {issue.title} <span className="font-mono text-slate-500">#{issue.number}</span>
                        </a>
                        <p className="text-[10px] text-slate-400 font-mono">
                          Reported by {issue.user?.login} on {new Date(issue.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                      issue.state === 'open' ? 'bg-rose-950 text-rose-400 border border-rose-500/30' : 'bg-slate-900 text-slate-400 border border-slate-700'
                    }`}>
                      {issue.state}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
