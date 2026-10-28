import React, { useState, useEffect, useRef } from 'react';
import { projectApi } from '../../api/projectApi';
import { resultApi } from '../../api/resultApi';
import { StaffResultCorrectionModal } from './StaffResultCorrectionModal';
import GitHubRepoDashboard from '../../components/common/GitHubRepoDashboard';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'group', label: 'Group & Members', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'submissions', label: 'Submissions', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'github', label: 'GitHub', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  { id: 'progress', label: 'Progress', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'review', label: 'Review & Feedback', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'results', label: 'Results & Marks', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
];

export const StaffProjectDetailView = ({ projectId, initialSection, onBack }) => {
  const [activeSection, setActiveSection] = useState(initialSection || 'overview');
  const [oversightData, setOversightData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Lazy loaded sub-data
  const [updates, setUpdates] = useState([]);
  const [github, setGithub] = useState(null);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Staff Progress Control state
  const [progressDetails, setProgressDetails] = useState(null);
  const [progressInput, setProgressInput] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);

  // Score correction modal
  const [correctionTarget, setCorrectionTarget] = useState(null);

  // In-memory cache for fast tab-switching
  const cacheRef = useRef({});

  useEffect(() => {
    if (initialSection && SECTIONS.some((s) => s.id === initialSection)) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  useEffect(() => {
    if (projectId) {
      loadProjectOversight(projectId);
    }
  }, [projectId]);

  // Lazy-load GitHub data when user switches to GitHub tab
  useEffect(() => {
    if (activeSection === 'github' && projectId && !github && oversightData?.project?.github_repo_url) {
      loadGithubData(projectId);
    }
  }, [activeSection, projectId, oversightData]);

  // Lazy-load updates when on overview tab
  useEffect(() => {
    if (activeSection === 'overview' && projectId && updates.length === 0) {
      loadUpdatesData(projectId);
    }
  }, [activeSection, projectId]);

  // Load progress details on mount or tab change
  useEffect(() => {
    if (projectId && (activeSection === 'progress' || activeSection === 'overview')) {
      loadProgressDetails(projectId);
    }
  }, [activeSection, projectId]);

  const loadProjectOversight = async (pId, force = false) => {
    if (!force && cacheRef.current[pId]?.oversight) {
      setOversightData(cacheRef.current[pId].oversight);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await projectApi.getStaffProjectOversight(pId);
      setOversightData(data);
      if (!cacheRef.current[pId]) cacheRef.current[pId] = {};
      cacheRef.current[pId].oversight = data;
    } catch (err) {
      setError(err.message || 'Failed to load project oversight details.');
    } finally {
      setLoading(false);
    }
  };

  const loadGithubData = async (pId) => {
    setLoadingGithub(true);
    try {
      const gh = await projectApi.getGithub(pId);
      setGithub(gh);
      if (cacheRef.current[pId]) cacheRef.current[pId].github = gh;
    } catch {
      // Graceful fallback
    } finally {
      setLoadingGithub(false);
    }
  };

  const loadUpdatesData = async (pId) => {
    try {
      const upd = await projectApi.getUpdates(pId);
      setUpdates(upd || []);
    } catch {
      // Graceful fallback
    }
  };

  const loadProgressDetails = async (pId) => {
    try {
      const prog = await projectApi.getProgress(pId);
      setProgressDetails(prog);
      setProgressInput(String(prog.progress_percentage ?? 0));
    } catch {
      // Graceful fallback
    }
  };

  const handleSaveProgress = async (e) => {
    e?.preventDefault();
    const val = parseFloat(progressInput);
    if (isNaN(val) || val < 0 || val > 100) {
      setError('Progress percentage must be a number between 0 and 100.');
      return;
    }
    setSavingProgress(true);
    setError(null);
    try {
      const updated = await projectApi.updateProgress(projectId, {
        progress_percentage: val,
        reset_to_calculated: false,
      });
      setProgressDetails(updated);
      setProgressInput(String(updated.progress_percentage));
      setSuccess(`Project progress updated to ${updated.progress_percentage}%.`);
      if (oversightData?.project) {
        setOversightData((prev) => ({
          ...prev,
          project: {
            ...prev.project,
            progress_percentage: updated.progress_percentage,
          },
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to update project progress.');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleResetProgress = async () => {
    if (!window.confirm('Reset project progress back to the automatically calculated milestone percentage?')) {
      return;
    }
    setSavingProgress(true);
    setError(null);
    try {
      const updated = await projectApi.updateProgress(projectId, {
        reset_to_calculated: true,
      });
      setProgressDetails(updated);
      setProgressInput(String(updated.progress_percentage));
      setSuccess('Project progress reset to calculated milestone completion.');
      if (oversightData?.project) {
        setOversightData((prev) => ({
          ...prev,
          project: {
            ...prev.project,
            progress_percentage: updated.progress_percentage,
          },
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to reset project progress.');
    } finally {
      setSavingProgress(false);
    }
  };

  const handlePublishResults = async (roundId = null) => {
    if (!oversightData?.project?.workspace_id) return;
    const wsId = oversightData.project.workspace_id;
    if (!window.confirm(roundId ? `Publish and release evaluated marks for Round #${roundId}?` : 'Publish and release all evaluated marks for this workspace?')) {
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      if (roundId) {
        await resultApi.publishRoundResults(wsId, roundId);
      } else {
        await resultApi.publishWorkspaceResults(wsId);
      }
      setSuccess('Results published successfully! Eligible students can now inspect their marks.');
      // Refresh oversight data
      await loadProjectOversight(projectId, true);
    } catch (err) {
      setError(err.message || 'Failed to publish results.');
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
        <span className="text-xs font-mono text-slate-400">Loading comprehensive project oversight...</span>
      </div>
    );
  }

  if (error && !oversightData) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs font-mono text-teal-400 hover:underline">
          ← Back to Projects
        </button>
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      </div>
    );
  }

  const project = oversightData?.project;
  const submissions = oversightData?.submissions || [];
  const results = oversightData?.results || [];
  const rounds = oversightData?.rounds || [];
  const progressPct = project?.progress_percentage ?? 0;

  const hasUnreleasedResults = results.some((r) => !r.is_released);

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
      {/* Top Bar with Navigation & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3 py-1.5 bg-[#11181C] hover:bg-[#1B262E] text-slate-300 font-sans text-xs rounded border border-[#1B262E] transition-all flex items-center gap-1.5"
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                Oversight View
              </span>
              <h2 className="text-xl font-bold text-slate-100 font-serif">{project?.name}</h2>
              <span className="text-xs font-mono text-slate-400">ID #{project?.id}</span>
            </div>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Course: <strong className="text-slate-300">{project?.workspace_name}</strong> • Assigned Group:{' '}
              <strong className="text-teal-400 font-mono">{project?.group_name}</strong>
            </p>
          </div>
        </div>

        {/* Global Quick Action */}
        <div className="flex items-center gap-2">
          {hasUnreleasedResults && (
            <button
              onClick={() => handlePublishResults()}
              disabled={publishing}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {publishing ? 'Publishing...' : 'Release Evaluated Marks'}
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 font-bold">×</button>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 font-bold">×</button>
        </div>
      )}

      {/* Section Tabs Navigation Bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#1B262E] pb-2 scrollbar-none">
        {SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`px-3.5 py-2 text-xs font-sans font-medium rounded-lg transition-all flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#11181C]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={sec.icon} />
              </svg>
              <span>{sec.label}</span>
              {sec.id === 'submissions' && submissions.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#1B262E] text-slate-300">
                  {submissions.length}
                </span>
              )}
              {sec.id === 'results' && results.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                  {results.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Main Info & Updates */}
            <div className="lg:col-span-2 space-y-6">
              {/* Project Card */}
              <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100 font-serif">{project?.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 font-sans">
                      {project?.description || 'No description provided by the student group.'}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                    Created: {project?.created_at ? new Date(project.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#1B262E]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-mono">Weighted Course Progress</span>
                    <span className="text-teal-400 font-bold font-mono">{progressPct}%</span>
                  </div>
                  <div className="w-full bg-[#0B0F12] h-2.5 rounded-full overflow-hidden border border-[#1B262E]">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Informal Updates & Discussion */}
              <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
                <h4 className="text-sm font-bold text-slate-200 font-serif">Project Updates & Activity</h4>
                {updates.length === 0 ? (
                  <div className="text-center py-8 text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                    No informal activity updates posted for this project yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {updates.map((u) => (
                      <div key={u.id} className="p-3.5 bg-[#0B0F12] rounded-lg border border-[#1B262E] space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-slate-400">
                          <span className="font-semibold text-slate-200">{u.author_name}</span>
                          <span className="font-mono text-[10px]">{new Date(u.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-300 font-sans">{u.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 1 Col: Quick Roster & GitHub Glance */}
            <div className="space-y-6">
              {/* Group Snapshot */}
              <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-slate-200">Group Snapshot</h4>
                  <button
                    onClick={() => setActiveSection('group')}
                    className="text-xs text-teal-400 hover:underline font-mono"
                  >
                    View All →
                  </button>
                </div>
                <div className="space-y-2">
                  {(project?.members || []).map((m) => (
                    <div key={m.id} className="p-2.5 bg-[#0B0F12] rounded border border-[#1B262E] text-xs">
                      <div className="font-semibold text-slate-200">{m.full_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{m.email}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* GitHub Repo */}
              <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-3">
                <h4 className="text-sm font-bold text-slate-200">Repository Link</h4>
                {project?.github_repo_url ? (
                  <div className="space-y-2">
                    <a
                      href={project.github_repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-mono text-teal-400 hover:underline break-all block p-2 bg-[#0B0F12] rounded border border-[#1B262E]"
                    >
                      🔗 {project.github_repo_url}
                    </a>
                    <button
                      onClick={() => setActiveSection('github')}
                      className="w-full py-1.5 text-xs bg-[#162026] hover:bg-[#1E2B33] text-teal-300 rounded border border-[#1B262E] transition-all"
                    >
                      Open Repository Dashboard →
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-500 italic p-2 bg-[#0B0F12] rounded border border-[#1B262E]">
                    No GitHub repository connected yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Group & Members */}
      {activeSection === 'group' && (
        <div className="space-y-6">
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-100 font-serif">Assigned Group Roster</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Members registered in group: <strong className="text-teal-400">{project?.group_name}</strong>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {(project?.members || []).map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-[#0B0F12] rounded-xl border border-[#1B262E] flex justify-between items-center text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-200 text-sm">{m.full_name || m.email}</div>
                    <div className="text-slate-400 font-mono">{m.email}</div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    ID #{m.id}
                  </span>
                </div>
              ))}
              {(!project?.members || project.members.length === 0) && (
                <div className="col-span-2 py-8 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                  No members found in this group.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Submissions */}
      {activeSection === 'submissions' && (
        <div className="space-y-6">
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-100 font-serif">Submission History & Versions</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Complete audit trail of all code milestones submitted by the group.
                </p>
              </div>
              <span className="text-xs font-mono text-teal-400">Total: {submissions.length}</span>
            </div>

            {submissions.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                No submissions recorded for this project yet.
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((sub) => (
                  <div
                    key={sub.version_id}
                    className="p-4 bg-[#0B0F12] rounded-xl border border-[#1B262E] space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                          v{sub.version_number}
                        </span>
                        <span className="font-bold text-slate-200 text-sm">
                          {sub.round_name || `Round ${sub.round_number}`}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getStatusBadge(sub.status)}`}>
                          {sub.status}
                        </span>
                        {sub.is_released && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 uppercase">
                            Results Released
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-slate-500 text-[11px]">
                        Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 font-mono text-[11px] pt-1">
                      <div>
                        Submitter: <span className="text-slate-200">{sub.submitter_name || `User #${sub.submitted_by}`}</span>
                      </div>
                      <div>
                        Commit SHA: <span className="text-teal-400">{sub.commit_hash ? sub.commit_hash.slice(0, 8) : 'HEAD'}</span>
                      </div>
                    </div>

                    {sub.submission_notes && (
                      <p className="text-slate-300 italic bg-[#11181C] p-2.5 rounded border border-[#1B262E]">
                        "{sub.submission_notes}"
                      </p>
                    )}

                    {sub.feedback && (
                      <div className="p-2.5 bg-teal-500/5 rounded border border-teal-500/15 text-slate-300">
                        <span className="text-teal-400 font-mono text-[10px] uppercase font-bold block">Faculty Feedback ({sub.reviewer_name || 'Staff'}):</span>
                        {sub.feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: GitHub */}
      {activeSection === 'github' && (
        <div className="space-y-6">
          {project?.github_repo_url ? (
            loadingGithub ? (
              <div className="py-20 text-center text-xs font-mono text-slate-400">
                <div className="w-6 h-6 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin mx-auto mb-2" />
                Synchronizing repository commits...
              </div>
            ) : (
              <GitHubRepoDashboard
                repoUrl={project.github_repo_url}
                readOnly={true}
                syncedCommits={github?.commits || []}
                lastSyncedAt={github?.last_synced_at}
                onSyncRepo={async () => {
                  const res = await projectApi.syncGithub(projectId);
                  setGithub(res);
                  if (cacheRef.current[projectId]) {
                    cacheRef.current[projectId].github = res;
                  }
                }}
                projectMembers={project?.members || []}
              />
            )
          ) : (
            <div className="p-12 text-center border border-dashed border-[#1B262E] rounded-xl bg-[#11181C] space-y-2">
              <p className="text-sm font-semibold text-slate-300">No GitHub Repository Connected</p>
              <p className="text-xs text-slate-500 font-sans">
                The student group has not yet connected a public GitHub repository to this project.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Progress */}
      {activeSection === 'progress' && (
        <div className="space-y-6">
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 font-serif">Staff-Controlled Project Progress</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Configure the authoritative project progress percentage or allow automatic milestone calculation.
                </p>
              </div>
              {progressDetails?.is_staff_override ? (
                <span className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 text-xs font-mono font-medium">
                  ★ Staff Override Active
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 text-xs font-mono">
                  Milestone Calculated
                </span>
              )}
            </div>

            {/* Progress Input Form */}
            <form onSubmit={handleSaveProgress} className="p-4 rounded-lg bg-[#0B0F12] border border-[#1B262E] space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-mono uppercase text-slate-300 font-semibold block mb-1">
                    Set Project Progress (0 - 100%)
                  </label>
                  <p className="text-[11px] text-slate-500 font-sans">
                    This value will be displayed as the primary progress across student and staff dashboards.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={progressInput}
                      onChange={(e) => setProgressInput(e.target.value)}
                      className="w-28 bg-[#11181C] border border-[#1B262E] rounded-lg px-3 py-1.5 text-sm text-slate-100 font-mono text-right focus:outline-none focus:border-teal-500"
                      placeholder="0.0"
                      required
                    />
                    <span className="absolute right-8 top-1.5 text-xs text-slate-500 font-mono pointer-events-none">
                      %
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={savingProgress}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 shadow disabled:opacity-50 transition-all"
                  >
                    {savingProgress ? 'Saving...' : 'Save Progress'}
                  </button>
                  {progressDetails?.is_staff_override && (
                    <button
                      type="button"
                      onClick={handleResetProgress}
                      disabled={savingProgress}
                      className="px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-50"
                    >
                      Reset to Calculated
                    </button>
                  )}
                </div>
              </div>

              {progressDetails?.is_staff_override && (
                <div className="pt-3 border-t border-[#1B262E] text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span>
                    Last set by: <strong className="text-slate-200">{progressDetails.progress_updated_by_name || 'Staff'}</strong>
                  </span>
                  {progressDetails.progress_updated_at && (
                    <span>Updated: {new Date(progressDetails.progress_updated_at).toLocaleString()}</span>
                  )}
                </div>
              )}
            </form>

            {/* Current Authoritative Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono">Authoritative Progress</span>
                <span className="text-teal-400 font-bold font-mono text-sm">
                  {progressDetails?.progress_percentage ?? progressPct}%
                </span>
              </div>
              <div className="w-full bg-[#0B0F12] h-3 rounded-full overflow-hidden border border-[#1B262E]">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressDetails?.progress_percentage ?? progressPct}%` }}
                />
              </div>
            </div>

            {/* Curricular Assessment Milestones Breakdown */}
            <div className="pt-4 border-t border-[#1B262E] space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-mono uppercase text-slate-300 font-semibold tracking-wider">
                  Curricular Assessment Milestones
                </h4>
                <span className="text-xs font-mono text-slate-400">
                  Calculated Completion: <strong className="text-slate-200">{progressDetails?.calculated_progress_percentage ?? 0}%</strong>
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#0B0F12] p-3.5 rounded-lg border border-[#1B262E]">
                <p className="text-slate-400">
                  • Approved Marks: <strong className="text-slate-200">{progressDetails?.approved_marks ?? 0} pts</strong>
                </p>
                <p className="text-slate-400">
                  • Total Possible Marks: <strong className="text-slate-200">{progressDetails?.total_round_marks ?? 0} pts</strong>
                </p>
              </div>

              <div className="pt-2">
                <h5 className="text-[11px] font-mono uppercase text-slate-400 mb-2">
                  Review Rounds in Workspace ({rounds.length})
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rounds.map((r) => (
                    <div key={r.round_id} className="p-3 bg-[#0B0F12] rounded-lg border border-[#1B262E] flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-200">
                          Round {r.order_index}: {r.round_title}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">Max Score: {r.max_score} pts</div>
                      </div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                        ID #{r.round_id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Review & Feedback */}
      {activeSection === 'review' && (
        <div className="space-y-6">
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-100 font-serif">Formal Staff Evaluations</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Remarks, feedback, and verdicts submitted by authorized faculty reviewers.
                </p>
              </div>
            </div>

            {submissions.filter((s) => s.feedback || s.is_evaluated).length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                No formal evaluation records found for this project yet.
              </div>
            ) : (
              <div className="space-y-3">
                {submissions
                  .filter((s) => s.feedback || s.is_evaluated)
                  .map((sub) => (
                    <div
                      key={sub.version_id}
                      className="p-4 bg-[#0B0F12] rounded-xl border border-[#1B262E] space-y-3 text-xs"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 text-sm">
                            {sub.round_name} (v{sub.version_number})
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase ${getStatusBadge(sub.status)}`}>
                            {sub.status}
                          </span>
                        </div>
                        <span className="font-mono text-slate-400 text-xs">
                          Reviewer: <strong className="text-slate-200">{sub.reviewer_name || 'Staff Member'}</strong>
                        </span>
                      </div>

                      <div className="p-3 bg-[#11181C] rounded border border-[#1B262E] text-slate-300 font-sans">
                        {sub.feedback || 'No written remarks provided.'}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Results & Marks */}
      {activeSection === 'results' && (
        <div className="space-y-6">
          <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 font-serif">Evaluated Results & Marks Ledger</h3>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  Inspect student marks, execute staff score corrections, and release results to student dashboards.
                </p>
              </div>
              {hasUnreleasedResults && (
                <button
                  onClick={() => handlePublishResults()}
                  disabled={publishing}
                  className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {publishing ? 'Publishing...' : 'Release Evaluated Marks'}
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
                No evaluation marks entered for this project yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#0B0F12] text-slate-400 font-mono text-[10px] uppercase border-b border-[#1B262E]">
                    <tr>
                      <th className="py-3 px-3">Student</th>
                      <th className="py-3 px-3">Round</th>
                      <th className="py-3 px-3">Marks</th>
                      <th className="py-3 px-3">Percentage</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Feedback</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B262E]">
                    {results.map((res) => (
                      <tr key={res.id} className="hover:bg-[#162026]">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">{res.student_name}</div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {res.roll_number ? `#${res.roll_number} • ` : ''}
                            {res.student_email}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{res.round_name}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-400">
                          {res.score} / {res.max_score}
                        </td>
                        <td className="py-3 px-3 font-mono text-teal-400">{res.percentage}%</td>
                        <td className="py-3 px-3">
                          {res.is_released ? (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                              Published
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                              Draft
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400 max-w-[200px] truncate">
                          {res.feedback || 'None'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setCorrectionTarget(res)}
                            className="px-2.5 py-1 text-[11px] bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 rounded font-mono font-semibold transition-all"
                          >
                            Correct Score
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Score Correction Modal */}
      {correctionTarget && (
        <StaffResultCorrectionModal
          entry={correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          onSuccess={(msg) => {
            setSuccess(msg);
            loadProjectOversight(projectId, true);
          }}
        />
      )}
    </div>
  );
};
