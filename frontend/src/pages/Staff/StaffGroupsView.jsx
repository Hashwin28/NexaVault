import React, { useState, useEffect, useMemo } from 'react';
import { groupApi } from '../../api/groupApi';
import { workspaceApi } from '../../api/workspaceApi';

export const StaffGroupsView = ({ onSelectProject }) => {
  const [groups, setGroups] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState('ALL'); // ALL, WITH_PROJECT, NO_PROJECT
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeGroupDetail, setActiveGroupDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    fetchGroups(selectedWorkspace);
  }, [selectedWorkspace]);

  const fetchWorkspaces = async () => {
    try {
      const data = await workspaceApi.getMyWorkspaces();
      setWorkspaces(data || []);
    } catch {
      // Graceful fallback
    }
  };

  const fetchGroups = async (wsId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await groupApi.getStaffGroups(wsId || null);
      setGroups(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load groups data.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGroupDetail = async (group) => {
    setActiveGroupDetail(group);
    setDetailLoading(true);
    try {
      const detail = await groupApi.getStaffGroupDetail(group.id);
      setActiveGroupDetail(detail);
    } catch {
      // Keep existing data
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // Project status filter
      if (projectStatusFilter === 'WITH_PROJECT' && !g.has_project) return false;
      if (projectStatusFilter === 'NO_PROJECT' && g.has_project) return false;

      // Text query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = g.name?.toLowerCase().includes(q);
      const matchCode = g.code?.toLowerCase().includes(q);
      const matchWs = g.workspace_name?.toLowerCase().includes(q) || g.workspace_id?.toLowerCase().includes(q);
      const matchProject = g.project?.name?.toLowerCase().includes(q);
      const matchMember = g.members?.some(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q) ||
          m.roll_number?.toLowerCase().includes(q)
      );
      return matchName || matchCode || matchWs || matchProject || matchMember;
    });
  }, [groups, searchQuery, projectStatusFilter]);

  const stats = useMemo(() => {
    const total = groups.length;
    const withProj = groups.filter((g) => g.has_project).length;
    const withoutProj = total - withProj;
    const withSubmissions = groups.filter((g) => (g.submissions_count || 0) > 0).length;
    return { total, withProj, withoutProj, withSubmissions };
  }, [groups]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'IN_REVIEW':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'REVISION_REQUESTED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'SUBMITTED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif">Groups Directory & Project Linkage</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Inspect enrolled student cohorts, leadership, associated projects, and submission milestones.
          </p>
        </div>
        <button
          onClick={() => fetchGroups(selectedWorkspace)}
          className="px-3 py-1.5 bg-[#11181C] hover:bg-[#1B262E] text-slate-300 font-sans text-xs rounded border border-[#1B262E] transition-all flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Directory
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Enrolled Groups</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono">{stats.total}</div>
        </div>
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">Projects Initialized</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1 font-mono">{stats.withProj}</div>
        </div>
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">No Project Yet</div>
          <div className="text-2xl font-bold text-amber-400 mt-1 font-mono">{stats.withoutProj}</div>
        </div>
        <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
          <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400">Active Submissions</div>
          <div className="text-2xl font-bold text-teal-400 mt-1 font-mono">{stats.withSubmissions}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#11181C] p-4 rounded-xl border border-[#1B262E]">
        {/* Workspace select */}
        <div className="w-full sm:w-64">
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

        {/* Project Status Filter */}
        <div className="w-full sm:w-48">
          <select
            value={projectStatusFilter}
            onChange={(e) => setProjectStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#0B0F12] border border-[#1B262E] rounded-lg text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-sans"
          >
            <option value="ALL">All Group Statuses</option>
            <option value="WITH_PROJECT">With Project</option>
            <option value="NO_PROJECT">Without Project</option>
          </select>
        </div>

        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by group name, code, student name, roll number..."
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

      {/* Main Content */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <span className="text-xs font-mono text-slate-400">Loading groups directory...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-[#1B262E] rounded-xl bg-[#11181C]/50 space-y-2">
          <p className="text-sm font-semibold text-slate-300">No matching groups found.</p>
          <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto">
            {searchQuery
              ? 'Try modifying your search or clearing filters to see more results.'
              : 'No student groups are enrolled in the selected workspace yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-[#11181C] border border-[#1B262E] hover:border-slate-700 rounded-xl p-5 transition-all space-y-4 flex flex-col justify-between"
            >
              {/* Group Header */}
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        {group.code}
                      </span>
                      <h3 className="text-base font-bold text-slate-100 font-serif">{group.name}</h3>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <span>Course: {group.workspace_name}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-slate-500">{group.workspace_id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenGroupDetail(group)}
                    className="px-2.5 py-1 text-xs bg-[#162026] hover:bg-[#1E2B33] text-teal-300 font-sans rounded border border-[#1B262E] transition-all flex items-center gap-1 shrink-0"
                  >
                    Group Details →
                  </button>
                </div>

                {/* Creator / Leader info */}
                {group.creator_name && (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                    <span className="text-slate-500 font-mono">Leader / Creator:</span>
                    <span className="font-medium text-slate-300">{group.creator_name}</span>
                    {group.creator_email && (
                      <span className="text-slate-500 font-mono">({group.creator_email})</span>
                    )}
                  </div>
                )}
              </div>

              {/* Members Roster Snapshot */}
              <div className="space-y-2 bg-[#0B0F12] p-3 rounded-lg border border-[#1B262E]">
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                  <span>Enrolled Members ({group.members?.length || 0})</span>
                  <span>Active Roster</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(group.members || []).map((m) => (
                    <div
                      key={m.id}
                      className="px-2 py-1 bg-[#11181C] border border-[#1B262E] rounded text-xs flex items-center gap-1.5"
                    >
                      <span className="font-medium text-slate-200">{m.full_name || m.email}</span>
                      {m.roll_number && (
                        <span className="font-mono text-[10px] text-teal-400">#{m.roll_number}</span>
                      )}
                      {m.is_leader && (
                        <span className="text-[9px] bg-teal-500/20 text-teal-300 px-1 rounded uppercase font-mono">
                          Lead
                        </span>
                      )}
                    </div>
                  ))}
                  {(!group.members || group.members.length === 0) && (
                    <span className="text-xs text-slate-500 italic">No members found</span>
                  )}
                </div>
              </div>

              {/* Associated Project Section */}
              <div className="pt-2 border-t border-[#1B262E]">
                {group.has_project && group.project ? (
                  <div className="p-3.5 bg-[#0B0F12]/80 rounded-lg border border-[#1B262E] space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-teal-400">
                          Associated Project
                        </div>
                        <h4 className="text-sm font-bold text-slate-100 font-serif mt-0.5">
                          {group.project.name}
                        </h4>
                        {group.project.description && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-sans">
                            {group.project.description}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => onSelectProject?.(group.project.id)}
                        className="px-3 py-1 text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded font-sans font-semibold transition-all shrink-0"
                      >
                        Inspect Project →
                      </button>
                    </div>

                    {/* Progress Bar & Submissions Status */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-slate-400">Progress</span>
                          <span className="text-teal-400 font-bold">
                            {group.project.progress_percentage ?? 0}%
                          </span>
                        </div>
                        <div className="w-full bg-[#162026] h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full"
                            style={{ width: `${group.project.progress_percentage ?? 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="text-[10px] font-mono text-slate-400">Latest Submission</div>
                        <div className="flex items-center justify-end gap-1.5">
                          {group.latest_submission_status ? (
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getStatusBadge(
                                group.latest_submission_status
                              )}`}
                            >
                              {group.latest_submission_status}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-500">None</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 bg-amber-500/5 rounded-lg border border-amber-500/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400/60" />
                      <span className="text-amber-200/90 font-sans">No project initialized yet</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Awaiting student initialization</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group Detail Modal */}
      {activeGroupDetail && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F12] border border-[#1B262E] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#1B262E] flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    {activeGroupDetail.code}
                  </span>
                  <h3 className="text-lg font-bold text-slate-100 font-serif">
                    {activeGroupDetail.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 font-sans mt-1">
                  Workspace: {activeGroupDetail.workspace_name} ({activeGroupDetail.workspace_id})
                </p>
              </div>
              <button
                onClick={() => setActiveGroupDetail(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {detailLoading && (
                <div className="text-center py-2 text-xs font-mono text-teal-400 animate-pulse">
                  Syncing full oversight history...
                </div>
              )}

              {/* Leader & Creation Details */}
              <div className="grid grid-cols-2 gap-4 bg-[#11181C] p-4 rounded-xl border border-[#1B262E] text-xs">
                <div>
                  <div className="text-slate-500 font-mono text-[10px] uppercase">Group Leader</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {activeGroupDetail.creator_name || 'Not assigned'}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {activeGroupDetail.creator_email || ''}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 font-mono text-[10px] uppercase">Creation Date</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {activeGroupDetail.created_at
                      ? new Date(activeGroupDetail.created_at).toLocaleDateString()
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Enrolled Students ({activeGroupDetail.members?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(activeGroupDetail.members || []).map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-[#11181C] rounded-lg border border-[#1B262E] flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-2">
                          <span>{m.full_name || m.email}</span>
                          {m.is_leader && (
                            <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded font-mono uppercase">
                              Leader
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">{m.email}</div>
                      </div>
                      {m.roll_number && (
                        <div className="font-mono text-teal-400 text-xs">
                          Roll: #{m.roll_number}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Associated Project */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Associated Project
                </h4>
                {activeGroupDetail.has_project && activeGroupDetail.project ? (
                  <div className="bg-[#11181C] p-4 rounded-xl border border-[#1B262E] space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="text-sm font-bold text-slate-100 font-serif">
                          {activeGroupDetail.project.name}
                        </h5>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {activeGroupDetail.project.description || 'No description provided.'}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-400">
                        {activeGroupDetail.project.progress_percentage ?? 0}% Complete
                      </span>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          const pId = activeGroupDetail.project.id;
                          setActiveGroupDetail(null);
                          onSelectProject?.(pId);
                        }}
                        className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded transition-all"
                      >
                        Open Project Oversight View →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#11181C] rounded-xl border border-[#1B262E] text-xs text-slate-400 italic">
                    This group has not initialized a project for this workspace yet.
                  </div>
                )}
              </div>

              {/* Submissions History */}
              {activeGroupDetail.submissions && activeGroupDetail.submissions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                    Recent Submissions ({activeGroupDetail.submissions.length})
                  </h4>
                  <div className="space-y-2">
                    {activeGroupDetail.submissions.map((sub) => (
                      <div
                        key={sub.id || sub.submission_id}
                        className="p-3 bg-[#11181C] rounded-lg border border-[#1B262E] flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-200">
                            {sub.round_title || `Round #${sub.round_id}`} (v{sub.version_number})
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A'}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getStatusBadge(
                            sub.status
                          )}`}
                        >
                          {sub.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#1B262E] flex justify-end">
              <button
                onClick={() => setActiveGroupDetail(null)}
                className="px-4 py-2 bg-[#162026] hover:bg-[#1E2B33] text-slate-300 font-sans text-xs rounded border border-[#1B262E]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
