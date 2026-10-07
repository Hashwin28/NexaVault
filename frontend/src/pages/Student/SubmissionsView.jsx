import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  FileCode, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  GitBranch, 
  ExternalLink, 
  Send, 
  MessageSquare, 
  AlertTriangle, 
  Save, 
  RefreshCw,
  FolderGit2
} from 'lucide-react';
import { groupApi } from '../../api/groupApi';
import { workspaceApi } from '../../api/workspaceApi';
import { projectApi } from '../../api/projectApi';
import { submissionApi } from '../../api/submissionApi';

export const SubmissionsView = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [project, setProject] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [updates, setUpdates] = useState([]);

  // Active review round selection for submission
  const [selectedRoundId, setSelectedRoundId] = useState(null);

  // New submission / draft form state
  const [subNotes, setSubNotes] = useState('');
  const [subLink, setSubLink] = useState('');
  const [subCommitSha, setSubCommitSha] = useState('');
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'finalize', versionId, roundId }

  // Update & comments form
  const [newUpdateContent, setNewUpdateContent] = useState('');
  const [newUpdateLink, setNewUpdateLink] = useState('');
  const [commentInputs, setCommentInputs] = useState({}); // updateId -> string
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Group
      let myGroup = null;
      try {
        myGroup = await groupApi.getMyGroup();
        setGroup(myGroup);
      } catch (err) {
        if (err.status !== 404) throw err;
        setGroup(null);
      }

      // 2. Fetch Workspaces
      const wsList = await workspaceApi.getMyWorkspaces();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        const first = wsList.find(w => w.has_project) || wsList[0];
        setSelectedWorkspace(first);
        if (first.has_project && first.project_id) {
          await loadProjectContext(first.id, first.project_id);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load submissions data');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectContext = async (workspaceId, projectId) => {
    try {
      const [projData, roundsData, subsData, updatesData] = await Promise.all([
        projectApi.getProject(projectId),
        workspaceApi.getRounds(workspaceId),
        submissionApi.getSubmissions(projectId),
        projectApi.getUpdates(projectId)
      ]);
      setProject(projData);
      setRounds(roundsData);
      setSubmissions(subsData);
      setUpdates(updatesData);

      if (roundsData.length > 0 && !selectedRoundId) {
        setSelectedRoundId(roundsData[0].id);
      }
    } catch (err) {
      console.error('Failed loading project context:', err);
    }
  };

  const handleWorkspaceChange = async (wsId) => {
    const ws = workspaces.find(w => w.id === wsId);
    setSelectedWorkspace(ws);
    setProject(null);
    setSubmissions([]);
    setRounds([]);
    setUpdates([]);
    setSelectedRoundId(null);

    if (ws && ws.has_project && ws.project_id) {
      await loadProjectContext(ws.id, ws.project_id);
    }
  };

  const canSubmit = group && (group.members?.length || 0) >= 2;

  const handleCreateOrDraftSubmission = async (e) => {
    e.preventDefault();
    if (!project || !selectedRoundId) return;

    if (!canSubmit) {
      alert('Submissions require at least 2 active group members.');
      return;
    }

    setSubmitting(true);
    try {
      await submissionApi.createSubmission(project.id, selectedRoundId, {
        notes: subNotes || null,
        link: subLink || null,
        github_commit_sha: subCommitSha || null,
        is_draft: isDraftMode
      });
      setActionSuccess(isDraftMode ? 'Draft version saved successfully.' : 'Deliverable submitted successfully.');
      setSubNotes('');
      setSubLink('');
      setSubCommitSha('');
      // Reload submissions
      const refreshedSubs = await submissionApi.getSubmissions(project.id);
      setSubmissions(refreshedSubs);
    } catch (err) {
      alert(err.message || 'Failed to create submission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalizeDraft = async (roundId, versionId) => {
    if (!project) return;
    if (!canSubmit) {
      alert('Submissions require at least 2 active group members.');
      return;
    }

    try {
      await submissionApi.finalizeSubmit(project.id, roundId, versionId);
      setActionSuccess('Draft finalized and submitted for evaluation.');
      setConfirmModal(null);
      const refreshedSubs = await submissionApi.getSubmissions(project.id);
      setSubmissions(refreshedSubs);
    } catch (err) {
      alert(err.message || 'Failed to finalize submission');
    }
  };

  const handlePostUpdate = async (e) => {
    e.preventDefault();
    if (!project || !newUpdateContent.trim()) return;
    try {
      await projectApi.postUpdate(project.id, {
        content: newUpdateContent.trim(),
        link: newUpdateLink.trim() || null
      });
      setNewUpdateContent('');
      setNewUpdateLink('');
      setActionSuccess('Progress update published.');
      const refreshed = await projectApi.getUpdates(project.id);
      setUpdates(refreshed);
    } catch (err) {
      alert(err.message || 'Failed to post update');
    }
  };

  const handlePostComment = async (updateId) => {
    const text = commentInputs[updateId];
    if (!project || !text || !text.trim()) return;
    try {
      await projectApi.postComment(project.id, updateId, { content: text.trim() });
      setCommentInputs({ ...commentInputs, [updateId]: '' });
      const refreshed = await projectApi.getUpdates(project.id);
      setUpdates(refreshed);
    } catch (err) {
      alert(err.message || 'Failed to post comment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-sans text-sm">
        <RefreshCw size={20} className="animate-spin mr-3 text-teal-400" />
        Loading Submissions & Project Streams...
      </div>
    );
  }

  return (
    <div className="space-y-8 select-none">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
            Submissions & Updates
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Manage course deliverable versions, drafts, audit reviews, and project communication stream.
          </p>
        </div>

        {/* Workspace Selector Dropdown */}
        {workspaces.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-slate-400 uppercase">Vault Context:</label>
            <select
              value={selectedWorkspace?.id || ''}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="bg-vault-surface border border-teal-500/30 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-teal-400"
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-teal-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Group Requirement Guard Banner */}
      {group && group.members && group.members.length < 2 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">Deliverable Submissions Blocked</p>
            <p className="text-slate-300">
              Your group currently has {group.members.length} member. NexaVault policy requires a minimum of <strong>2 group members</strong> before any deliverables can be submitted or drafts finalized. Invite a peer using your group code to unlock submissions.
            </p>
          </div>
        </div>
      )}

      {!group && (
        <div className="p-8 text-center bg-vault-surface border border-vault-border rounded-2xl space-y-3">
          <AlertCircle size={32} className="mx-auto text-amber-400" />
          <h3 className="text-base font-bold text-white">No Group Membership Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You must belong to a group and be enrolled in an active course workspace before submitting deliverables.
          </p>
        </div>
      )}

      {group && !project && selectedWorkspace && (
        <div className="p-8 text-center bg-vault-surface border border-vault-border rounded-2xl space-y-3">
          <FolderGit2 size={32} className="mx-auto text-slate-500" />
          <h3 className="text-base font-bold text-white">No Project Found in {selectedWorkspace.name}</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Your group is enrolled in this workspace, but a project has not yet been registered. Visit the <strong>Projects</strong> tab to initialize your group project.
          </p>
        </div>
      )}

      {/* Main Dual-Column Content */}
      {group && project && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Submissions & Version Management (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* New Deliverable Submission Card */}
            <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-vault-border/40 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <UploadCloud size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white font-serif">Submit Artifact / Revision</h2>
                    <p className="text-xs text-slate-400">Upload new code revision or draft for faculty evaluation</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-sans px-2 py-0.5 rounded-full border ${
                    canSubmit 
                      ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}>
                    {canSubmit ? '✓ Group Ready (≥2)' : 'Locked (<2)'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleCreateOrDraftSubmission} className="space-y-4 text-xs">
                {/* Round Selector */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Review Round</label>
                  <select
                    value={selectedRoundId || ''}
                    onChange={(e) => setSelectedRoundId(Number(e.target.value))}
                    className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-white outline-none focus:border-teal-500 font-mono"
                    required
                  >
                    {rounds.map(r => (
                      <option key={r.id} value={r.id}>
                        Round {r.order_index}: {r.title} ({r.max_score} pts) — {r.is_open ? 'Open' : 'Closed'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Artifact Link */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Deliverable Link / Documentation URL</label>
                  <input
                    type="url"
                    value={subLink}
                    onChange={(e) => setSubLink(e.target.value)}
                    placeholder="https://drive.google.com/... or https://github.com/..."
                    className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-white outline-none focus:border-teal-500 font-mono text-xs"
                  />
                </div>

                {/* Git Commit SHA */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Git Commit SHA (Optional)</label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={100}
                      value={subCommitSha}
                      onChange={(e) => setSubCommitSha(e.target.value)}
                      placeholder="e.g. 7c91498b849f131a..."
                      className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 pl-8 text-white outline-none focus:border-teal-500 font-mono text-xs"
                    />
                    <GitBranch size={14} className="absolute left-2.5 top-3 text-slate-500" />
                  </div>
                </div>

                {/* Deliverable Notes */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Implementation Notes & Changelog</label>
                  <textarea
                    rows={3}
                    value={subNotes}
                    onChange={(e) => setSubNotes(e.target.value)}
                    placeholder="Describe what was implemented in this version, known test edge cases, and architectural notes..."
                    className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-white outline-none focus:border-teal-500 resize-none font-sans"
                    required
                  />
                </div>

                {/* Submission Actions */}
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="draftCheck"
                      checked={isDraftMode}
                      onChange={(e) => setIsDraftMode(e.target.checked)}
                      className="rounded border-vault-border text-teal-500 focus:ring-0 bg-vault-canvas"
                    />
                    <label htmlFor="draftCheck" className="text-slate-300 text-xs cursor-pointer">
                      Save as preliminary draft (editable later)
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-sm ${
                      canSubmit 
                        ? isDraftMode 
                          ? 'bg-vault-canvas hover:bg-vault-elevated text-teal-300 border border-teal-500/30' 
                          : 'bg-teal-500 hover:bg-teal-400 text-slate-950 hover:shadow-teal-glow'
                        : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {submitting ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : isDraftMode ? (
                      <Save size={14} />
                    ) : (
                      <UploadCloud size={14} />
                    )}
                    <span>{isDraftMode ? 'Save Draft' : 'Submit Deliverable'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Submission History / Rounds List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider text-slate-400">
                Evaluation History by Review Round
              </h3>

              {rounds.length === 0 ? (
                <div className="p-6 text-center bg-vault-surface border border-vault-border rounded-xl text-slate-500 text-xs">
                  No review rounds scheduled for this workspace.
                </div>
              ) : (
                rounds.map(round => {
                  const subForRound = submissions.find(s => s.round_id === round.id);
                  const versions = subForRound?.versions || [];

                  return (
                    <div key={round.id} className="bg-vault-surface border border-vault-border/60 rounded-xl p-5 space-y-4">
                      {/* Round Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-vault-border/30 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-teal-400">Round {round.order_index}</span>
                            <h4 className="text-sm font-bold text-white">{round.title}</h4>
                            <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                              round.is_open ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                            }`}>
                              {round.is_open ? 'Active' : 'Closed'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{round.description || 'No description provided.'}</p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-mono text-slate-400">Max Score: </span>
                          <span className="text-xs font-mono font-bold text-white">{round.max_score} pts</span>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Due: {new Date(round.due_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Versions Timeline for this round */}
                      {versions.length === 0 ? (
                        <div className="p-4 bg-vault-canvas/50 rounded-lg border border-vault-border/30 text-center text-xs text-slate-500">
                          No submissions or drafts recorded for this round yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {versions.map(v => (
                            <div 
                              key={v.id} 
                              className={`p-3.5 rounded-lg border text-xs space-y-2 transition-colors ${
                                v.status === 'draft'
                                  ? 'bg-amber-500/5 border-amber-500/30 text-slate-300'
                                  : 'bg-vault-canvas/80 border-vault-border/60 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white">v{v.version_number}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                                    v.status === 'draft' 
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                      : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                  }`}>
                                    {v.status}
                                  </span>
                                  {v.is_late && (
                                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                      Late
                                    </span>
                                  )}
                                </div>

                                <div className="text-right text-[11px] font-mono text-slate-400">
                                  {v.submitted_at 
                                    ? `Submitted ${new Date(v.submitted_at).toLocaleDateString()}` 
                                    : `Created ${new Date(v.created_at).toLocaleDateString()}`}
                                </div>
                              </div>

                              <p className="text-slate-300 font-sans leading-relaxed text-xs">
                                {v.notes || 'No version notes recorded.'}
                              </p>

                              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-vault-border/30 text-[11px]">
                                {v.link && (
                                  <a 
                                    href={v.link} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 font-mono"
                                  >
                                    <ExternalLink size={12} />
                                    <span>Artifact URL</span>
                                  </a>
                                )}
                                {v.github_commit_sha && (
                                  <span className="inline-flex items-center gap-1 font-mono text-slate-400">
                                    <GitBranch size={12} />
                                    <span>commit: {v.github_commit_sha.slice(0, 7)}</span>
                                  </span>
                                )}
                                <span className="text-slate-500 ml-auto font-mono text-[10px]">
                                  by {v.submitter_name || `Member #${v.submitted_by}`}
                                </span>
                              </div>

                              {/* Draft Finalization Action */}
                              {v.status === 'draft' && (
                                <div className="pt-2 flex justify-end gap-2 border-t border-amber-500/20">
                                  <button
                                    onClick={() => setConfirmModal({ type: 'finalize', versionId: v.id, roundId: round.id })}
                                    disabled={!canSubmit}
                                    className={`px-3 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 ${
                                      canSubmit 
                                        ? 'bg-teal-500 text-slate-950 hover:bg-teal-400' 
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Finalize Submission</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Right Column: Project Updates Stream & Comments (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Updates Stream Card */}
            <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2.5 border-b border-vault-border/40 pb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white font-serif">Updates & Faculty Stream</h2>
                  <p className="text-xs text-slate-400">Share milestone progress and discuss with reviewers</p>
                </div>
              </div>

              {/* Post Update Form */}
              <form onSubmit={handlePostUpdate} className="space-y-3">
                <textarea
                  rows={2}
                  value={newUpdateContent}
                  onChange={(e) => setNewUpdateContent(e.target.value)}
                  placeholder="Post project progress update or sprint summary..."
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg p-2.5 text-xs text-white outline-none focus:border-teal-500 resize-none font-sans"
                  required
                />
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={newUpdateLink}
                    onChange={(e) => setNewUpdateLink(e.target.value)}
                    placeholder="Optional external link..."
                    className="flex-1 bg-vault-canvas border border-vault-border rounded-lg p-2 text-xs text-white outline-none focus:border-teal-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0"
                  >
                    <Send size={13} />
                    <span>Post</span>
                  </button>
                </div>
              </form>

              {/* Updates List */}
              <div className="space-y-4 pt-2">
                {updates.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No project updates posted yet.</p>
                ) : (
                  updates.map(u => (
                    <div key={u.id} className="p-3.5 rounded-xl bg-vault-canvas border border-vault-border/60 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-teal-300 font-display">{u.author_name}</span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <p className="text-slate-300 font-sans leading-relaxed text-xs">{u.content}</p>

                      {u.link && (
                        <a 
                          href={u.link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 font-mono text-[11px]"
                        >
                          <ExternalLink size={12} />
                          <span>Attached Link</span>
                        </a>
                      )}

                      {/* Comments Thread */}
                      <div className="pt-2 border-t border-vault-border/40 space-y-2">
                        {u.comments?.map(c => (
                          <div key={c.id} className="p-2 rounded bg-vault-surface border border-vault-border/40 text-[11px] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-300">
                                {c.author_name}
                                {c.author_role === 'staff' && (
                                  <span className="ml-1.5 px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">STAFF</span>
                                )}
                              </span>
                              <span className="text-slate-500 text-[10px] font-mono">
                                {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-400 font-sans">{c.content}</p>
                          </div>
                        ))}

                        {/* Add Comment Input */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={commentInputs[u.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [u.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handlePostComment(u.id);
                              }
                            }}
                            placeholder="Add a comment..."
                            className="flex-1 bg-vault-surface border border-vault-border rounded px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-teal-500"
                          />
                          <button
                            type="button"
                            onClick={() => handlePostComment(u.id)}
                            className="p-1.5 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Confirmation Modal for Finalize */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-vault-surface border border-teal-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">Confirm Final Submission</h3>
                <p className="text-xs text-slate-400">Lock deliverable version for faculty evaluation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to finalize this draft? Once submitted, this version cannot be silently edited. Any subsequent changes will require uploading a new revision number.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg bg-vault-elevated border border-vault-border text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFinalizeDraft(confirmModal.roundId, confirmModal.versionId)}
                className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-xs text-slate-950 font-bold"
              >
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
