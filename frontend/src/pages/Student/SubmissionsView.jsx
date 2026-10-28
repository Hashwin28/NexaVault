import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  GitBranch, 
  ExternalLink, 
  AlertTriangle, 
  Save, 
  RefreshCw,
  FolderGit2,
  Calendar,
  Layers,
  MessageSquare
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

  // Active review round selection for submission
  const [selectedRoundId, setSelectedRoundId] = useState(null);

  // New submission / draft form state
  const [subNotes, setSubNotes] = useState('');
  const [subLink, setSubLink] = useState('');
  const [subCommitSha, setSubCommitSha] = useState('');
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'finalize', versionId, roundId }
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
      const [projData, roundsData, subsData] = await Promise.all([
        projectApi.getProject(projectId),
        workspaceApi.getRounds(workspaceId),
        submissionApi.getSubmissions(projectId)
      ]);
      setProject(projData);
      setRounds(roundsData);
      setSubmissions(subsData);

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
        githubCommitSha: subCommitSha || null,
        isDraft: isDraftMode
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

  const handleFinalizeDraft = async (submissionId) => {
    if (!project) return;
    if (!canSubmit) {
      alert('Submissions require at least 2 active group members.');
      return;
    }

    try {
      await submissionApi.finalizeSubmit(submissionId);
      setActionSuccess('Draft finalized and submitted for evaluation.');
      setConfirmModal(null);
      const refreshedSubs = await submissionApi.getSubmissions(project.id);
      setSubmissions(refreshedSubs);
    } catch (err) {
      alert(err.message || 'Failed to finalize submission');
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-vault-border/50 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
            Milestone Submissions & Evaluations
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Submit milestone code deliverables, track version history, and view official faculty review feedback.
          </p>
        </div>

        {/* Workspace Selector */}
        {workspaces.length > 1 && (
          <div className="flex items-center gap-2 bg-vault-surface border border-vault-border rounded-xl p-1.5 shrink-0">
            <span className="text-xs text-slate-400 font-sans pl-2">Workspace:</span>
            <select
              value={selectedWorkspace?.id || ''}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              className="bg-vault-canvas border-none text-xs text-slate-200 font-sans py-1.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name} ({ws.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs flex items-center justify-between font-sans">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-white font-mono text-xs">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 font-sans">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      {loading ? (
        <div className="py-20 text-center text-xs font-mono text-slate-500 bg-vault-surface/40 rounded-2xl border border-vault-border/40">
          Loading submission context...
        </div>
      ) : !selectedWorkspace ? (
        <div className="py-16 text-center border border-dashed border-vault-border/60 rounded-2xl bg-vault-canvas/50 p-6">
          <Layers size={32} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 font-sans">No Workspace Enrolled</h3>
          <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto mt-1">
            Join a student group and enroll in a course workspace to submit project deliverables.
          </p>
        </div>
      ) : !project ? (
        <div className="py-16 text-center border border-dashed border-vault-border/60 rounded-2xl bg-vault-canvas/50 p-6">
          <FolderGit2 size={32} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300 font-sans">No Project Initialized</h3>
          <p className="text-xs text-slate-500 font-sans max-w-sm mx-auto mt-1">
            Create or register your team project under {selectedWorkspace.name} before submitting milestone deliverables.
          </p>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Group & Project Overview Card */}
          <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-card-subtle">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono text-xs font-semibold">
                  {selectedWorkspace.id}
                </span>
                <span className="text-xs text-slate-400 font-sans font-medium">
                  {selectedWorkspace.name}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white font-sans flex items-center gap-2">
                <FolderGit2 size={18} className="text-teal-400" />
                {project.name}
              </h2>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 bg-vault-canvas px-3.5 py-2 rounded-xl border border-vault-border shrink-0">
              <div>
                Group: <span className="text-white font-bold">{group?.name || 'My Team'}</span>
              </div>
              <div className="border-l border-vault-border pl-3">
                Members: <span className={canSubmit ? 'text-teal-400 font-bold' : 'text-amber-400 font-bold'}>
                  {group?.members?.length || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Deliverable Submission Form Card */}
          <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-5 shadow-card-subtle">
            <div className="border-b border-vault-border/40 pb-4">
              <h2 className="text-base font-bold text-white font-sans">
                Submit Milestone Deliverable
              </h2>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Upload your latest implementation links, GitHub commit hash, and summary notes for the selected review round.
              </p>
            </div>

            <form onSubmit={handleCreateOrDraftSubmission} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Round Selector */}
                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase block mb-1 font-semibold">
                    Target Review Round
                  </label>
                  <select
                    value={selectedRoundId || ''}
                    onChange={(e) => setSelectedRoundId(Number(e.target.value))}
                    className="w-full bg-vault-canvas border border-vault-border rounded-lg px-3 py-2 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
                  >
                    {rounds.map((r) => (
                      <option key={r.id} value={r.id}>
                        Round {r.order_index}: {r.title} ({r.max_score} marks) {r.is_open ? '• Active' : '• Closed'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* GitHub Commit SHA */}
                <div>
                  <label className="text-xs font-mono text-slate-400 uppercase block mb-1 font-semibold">
                    GitHub Commit SHA (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 7f8a9b2"
                    value={subCommitSha}
                    onChange={(e) => setSubCommitSha(e.target.value)}
                    className="w-full bg-vault-canvas border border-vault-border rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              {/* Artifact URL */}
              <div>
                <label className="text-xs font-mono text-slate-400 uppercase block mb-1 font-semibold">
                  Deliverable Artifact Link (Report URL, Demo Link, or PR)
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/... or https://drive.google.com/..."
                  value={subLink}
                  onChange={(e) => setSubLink(e.target.value)}
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg px-3 py-2 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Submission Notes */}
              <div>
                <label className="text-xs font-mono text-slate-400 uppercase block mb-1 font-semibold">
                  Submission Notes & Deliverable Summary
                </label>
                <textarea
                  rows={3}
                  placeholder="Summarize key features completed, test coverage, and documentation for faculty evaluation..."
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  className="w-full bg-vault-canvas border border-vault-border rounded-lg px-3 py-2 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500 leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-vault-border/40">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="draftMode"
                    checked={isDraftMode}
                    onChange={(e) => setIsDraftMode(e.target.checked)}
                    className="rounded bg-vault-canvas border-vault-border text-teal-500 focus:ring-0"
                  />
                  <label htmlFor="draftMode" className="text-xs font-sans text-slate-300 cursor-pointer">
                    Save as draft only (can be modified before final submission)
                  </label>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !canSubmit}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition-all w-full sm:w-auto ${
                      canSubmit
                        ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-sm'
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
              </div>
            </form>
          </div>

          {/* Submission History / Review Rounds List */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white font-sans uppercase tracking-wider text-slate-300">
              Review Rounds & Evaluation History
            </h2>

            {rounds.length === 0 ? (
              <div className="p-8 text-center bg-vault-surface border border-vault-border rounded-2xl text-slate-500 text-xs font-sans">
                No review rounds scheduled for this workspace.
              </div>
            ) : (
              rounds.map((round) => {
                const subForRound = submissions.find((s) => s.round_id === round.id);
                const versions = subForRound?.versions || [];

                return (
                  <div key={round.id} className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-5 shadow-card-subtle">
                    {/* Round Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-vault-border/30 pb-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20 shrink-0">
                            Round {round.order_index}
                          </span>
                          <h3 className="text-base font-bold text-white font-sans break-words">{round.title}</h3>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 font-bold uppercase ${
                            round.is_open ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}>
                            {round.is_open ? 'Active' : 'Closed'}
                          </span>
                        </div>
                        {round.description && (
                          <p className="text-xs text-slate-400 font-sans mt-0.5 break-words leading-relaxed">
                            {round.description}
                          </p>
                        )}
                      </div>

                      <div className="sm:text-right text-left shrink-0 font-mono text-xs pt-2 sm:pt-0 border-t sm:border-t-0 border-vault-border/20">
                        <div className="flex sm:justify-end items-center gap-1.5">
                          <span className="text-slate-400">Max Score:</span>
                          <span className="font-bold text-white">{round.max_score} marks</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex sm:justify-end items-center gap-1">
                          <Calendar size={11} />
                          <span>Due: {new Date(round.due_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Versions Timeline for this round */}
                    {versions.length === 0 ? (
                      <div className="p-5 bg-vault-canvas/50 rounded-xl border border-vault-border/40 text-center text-xs text-slate-500 font-sans">
                        No submissions or drafts recorded for Round {round.order_index} yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {versions.map((v) => (
                          <div 
                            key={v.id} 
                            className={`p-4 rounded-xl border text-xs space-y-3 transition-colors ${
                              v.status?.toLowerCase() === 'draft'
                                ? 'bg-amber-500/5 border-amber-500/30 text-slate-300'
                                : v.status === 'REVISION_REQUESTED'
                                ? 'bg-amber-950/20 border-amber-500/40 text-slate-200'
                                : v.status === 'APPROVED'
                                ? 'bg-emerald-950/15 border-emerald-500/30 text-slate-200'
                                : 'bg-vault-canvas/80 border-vault-border/60 text-slate-300'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-vault-border/30 pb-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-white bg-vault-surface px-2 py-0.5 rounded border border-vault-border">
                                  v{v.version_number}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                                  v.status?.toLowerCase() === 'draft' 
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                                    : v.status === 'REVISION_REQUESTED'
                                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50'
                                    : v.status === 'APPROVED'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                }`}>
                                  {v.status === 'REVISION_REQUESTED' ? 'Revision Requested' : v.status}
                                </span>
                                {v.is_late && (
                                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                    Late
                                  </span>
                                )}
                              </div>

                              <div className="text-right text-[11px] font-mono text-slate-400">
                                {v.submitted_at 
                                  ? `Submitted ${new Date(v.submitted_at).toLocaleString()}` 
                                  : `Created ${new Date(v.created_at).toLocaleString()}`}
                              </div>
                            </div>

                            {v.notes && (
                              <p className="text-slate-200 font-sans leading-relaxed text-xs">
                                {v.notes}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-vault-border/30 text-[11px]">
                              {v.link && (
                                <a 
                                  href={v.link} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 font-mono hover:underline"
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
                              <span className="text-slate-400 ml-auto font-mono text-[10px]">
                                Submitted by: {v.submitter_name || `Member #${v.submitted_by}`}
                              </span>
                            </div>

                            {/* Round-Specific Faculty Evaluation Feedback */}
                            {v.feedback && (
                              <div className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 mt-2 ${
                                v.status === 'REVISION_REQUESTED'
                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-100'
                                  : 'bg-teal-500/10 border-teal-500/30 text-slate-200'
                              }`}>
                                <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
                                  <span className={v.status === 'REVISION_REQUESTED' ? 'text-amber-400' : 'text-teal-400'}>
                                    Faculty Evaluation Remarks {v.reviewer_name && `(${v.reviewer_name})`}:
                                  </span>
                                  {v.reviewed_at && (
                                    <span className="text-slate-400 font-normal">
                                      {new Date(v.reviewed_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="whitespace-pre-wrap font-sans text-xs text-slate-200">
                                  {v.feedback}
                                </p>
                                {v.status === 'REVISION_REQUESTED' && (
                                  <div className="pt-2 mt-2 border-t border-amber-500/30 text-[11px] font-sans text-amber-300 font-semibold flex items-center gap-2">
                                    <span>⚡ Required Next Action:</span>
                                    <span className="font-normal text-slate-200">
                                      Review the feedback above and submit a revised deliverable using the submission form above.
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Draft Finalization Action */}
                            {v.status?.toLowerCase() === 'draft' && (
                              <div className="pt-2 flex justify-end gap-2 border-t border-amber-500/20">
                                <button
                                  onClick={() => handleFinalizeDraft(v.submission_id || subForRound.id)}
                                  disabled={!canSubmit}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans flex items-center gap-1.5 transition-all ${
                                    canSubmit 
                                      ? 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-sm' 
                                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                  }`}
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Finalize & Submit Deliverable</span>
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
      )}
    </div>
  );
};
