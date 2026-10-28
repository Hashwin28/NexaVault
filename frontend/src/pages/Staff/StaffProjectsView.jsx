import React, { useState, useEffect, useMemo } from 'react';
import { projectApi } from '../../api/projectApi';
import { workspaceApi } from '../../api/workspaceApi';

export const StaffProjectsView = ({ onSelectProject }) => {
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradingFilter, setGradingFilter] = useState('ALL');
  const [resultsFilter, setResultsFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    fetchProjects(selectedWorkspace);
  }, [selectedWorkspace]);

  const fetchWorkspaces = async () => {
    try {
      const data = await workspaceApi.getMyWorkspaces();
      setWorkspaces(data || []);
    } catch {
      // Graceful fallback
    }
  };

  const fetchProjects = async (wsId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectApi.getStaffProjects(wsId || null);
      setProjects(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load projects oversight list.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Grading filter
      if (gradingFilter !== 'ALL' && p.grading_status !== gradingFilter) return false;

      // Results filter
      if (resultsFilter !== 'ALL' && p.results_status !== resultsFilter) return false;

      // Search text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchGroup = p.group_name?.toLowerCase().includes(q) || p.group_code?.toLowerCase().includes(q);
      const matchWs = p.workspace_name?.toLowerCase().includes(q) || p.workspace_id?.toLowerCase().includes(q);
      const matchMember = p.members?.some(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q)
      );
      return matchName || matchGroup || matchWs || matchMember;
    });
  }, [projects, searchQuery, gradingFilter, resultsFilter]);

  const stats = useMemo(() => {
    const total = projects.length;
    const published = projects.filter((p) => p.results_status === 'PUBLISHED').length;
    const draft = projects.filter((p) => p.results_status === 'DRAFT').length;
    const avgProgress = total > 0
      ? Math.round(projects.reduce((acc, p) => acc + (p.progress_percentage || 0), 0) / total)
      : 0;
    return { total, published, draft, avgProgress };
  }, [projects]);

  const getGradingBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'IN_REVIEW':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'REVISION_REQUESTED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'SUBMITTED':
      case 'PENDING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getResultsBadge = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'DRAFT':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">Staff Projects Oversight</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Monitor all student cohort projects, submissions, milestones, code repositories, and grade publication statuses.
          </p>
        </div>
        <button
          onClick={() => fetchProjects(selectedWorkspace)}
          className="px-3 py-1.5 bg-[#11181C] hover:bg-[#1B262E] text-slate-300 font-sans text-xs rounded border border-[#1B262E] transition-all flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Projects
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Projects</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{stats.total}</div>
        </div>
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Results Published</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{stats.published}</div>
        </div>
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Draft Evaluations</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{stats.draft}</div>
        </div>
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400">Average Progress</div>
          <div className="text-2xl font-bold text-teal-400 mt-1 font-mono">{stats.avgProgress}%</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-3 bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
        {/* Workspace select */}
        <div className="w-full lg:w-64">
          <select
            value={selectedWorkspace}
            onChange={(e) => setSelectedWorkspace(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-sans"
          >
            <option value="">All Workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.id})
              </option>
            ))}
          </select>
        </div>

        {/* Grading filter */}
        <div className="w-full sm:w-44">
          <select
            value={gradingFilter}
            onChange={(e) => setGradingFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-sans"
          >
            <option value="ALL">All Grading States</option>
            <option value="APPROVED">Approved</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="REVISION_REQUESTED">Revision Req.</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {/* Results filter */}
        <div className="w-full sm:w-44">
          <select
            value={resultsFilter}
            onChange={(e) => setResultsFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-sans"
          >
            <option value="ALL">All Results States</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search projects by name, group, code, student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-200"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading project oversight registry...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#1B262E] rounded-xl bg-[#11181C]/50 space-y-2">
          <p className="text-sm font-semibold text-slate-300">No matching projects found.</p>
          <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search or clearing filters to see more results.'
              : 'No projects have been registered in the selected workspace yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <div
              key={project.project_id}
              className="bg-[#11181C] border border-[#1B262E] hover:border-slate-700 rounded-xl p-5 transition-all space-y-4"
            >
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Project Header Info */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-100 font-serif">
                      {project.name}
                    </h3>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      ID #{project.project_id}
                    </span>
                    <span className="text-xs text-slate-400">
                      • {project.workspace_name}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-xs text-slate-400 line-clamp-1 font-sans">
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Primary CTA */}
                <button
                  onClick={() => onSelectProject?.(project.project_id)}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded transition-all flex items-center gap-1.5 shrink-0"
                >
                  Inspect Project Oversight →
                </button>
              </div>

              {/* Metrics & Roster Details Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3.5 bg-[#0B0F12] rounded-lg border border-[#1B262E] text-xs">
                {/* Group Details */}
                <div className="space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Assigned Group</div>
                  <div className="font-semibold text-slate-200">
                    {project.group_name || `Group #${project.group_id}`}
                  </div>
                  {project.group_code && (
                    <div className="font-mono text-[11px] text-teal-400">
                      Code: {project.group_code}
                    </div>
                  )}
                </div>

                {/* Member Roster Snapshot */}
                <div className="space-y-1 md:col-span-1">
                  <div className="text-[10px] font-mono uppercase text-slate-500">
                    Members ({project.members?.length || 0})
                  </div>
                  <div className="text-slate-300 truncate">
                    {project.members && project.members.length > 0
                      ? project.members.map((m) => m.full_name || m.email).join(', ')
                      : 'None assigned'}
                  </div>
                </div>

                {/* Weighted Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="uppercase text-slate-500">Course Progress</span>
                    <span className="text-teal-400 font-bold">
                      {project.progress_percentage ?? 0}%
                    </span>
                  </div>
                  <div className="w-full bg-[#162026] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full"
                      style={{ width: `${project.progress_percentage ?? 0}%` }}
                    />
                  </div>
                </div>

                {/* Milestone & Results Status Badges */}
                <div className="space-y-1 flex flex-col items-start md:items-end justify-center">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Evaluation Status</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getGradingBadge(
                        project.grading_status
                      )}`}
                    >
                      {project.grading_status}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getResultsBadge(
                        project.results_status
                      )}`}
                    >
                      {project.results_status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sub-bar: Latest submission notes, GitHub link */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-slate-400 pt-1">
                <div className="flex items-center gap-3">
                  <span>
                    Submissions: <strong className="text-slate-200 font-mono">{project.submission_count}</strong>
                  </span>
                  {project.latest_round_title && (
                    <span>
                      • Latest: <span className="text-slate-300 font-mono">{project.latest_round_title}</span> (v{project.latest_version_number})
                    </span>
                  )}
                </div>

                {project.github_repo_url ? (
                  <a
                    href={project.github_repo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-400 hover:underline font-mono text-[11px] flex items-center gap-1"
                  >
                    <span>GitHub Repo</span>
                    <span>↗</span>
                  </a>
                ) : (
                  <span className="text-slate-600 font-mono text-[11px]">No repo connected</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
