import React, { useState, useEffect } from 'react';
import { reviewApi } from '../../api/reviewApi';
import { useAuth } from '../../context/AuthContext';

export const StaffReviewQueueView = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Active evaluation modal state
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [verdict, setVerdict] = useState('APPROVED'); // 'APPROVED' or 'REVISION_REQUESTED'
  const [feedback, setFeedback] = useState('');
  const [memberScores, setMemberScores] = useState({});
  const [submittingEval, setSubmittingEval] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await reviewApi.getQueue();
      setQueue(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (versionId) => {
    setError(null);
    try {
      await reviewApi.claimSubmission(versionId);
      setSuccess('Submission claimed successfully.');
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to claim submission.');
    }
  };

  const handleReleaseClaim = async (versionId) => {
    setError(null);
    try {
      await reviewApi.releaseClaim(versionId);
      setSuccess('Submission claim released.');
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to release claim.');
    }
  };

  const handleOpenEvaluateModal = (item) => {
    setSelectedVersion(item);
    setVerdict('APPROVED');
    setFeedback('');
    
    // Initialize default member scores to max_score or 0
    const initialScores = {};
    const roster = item.roster_snapshot || item.members || [];
    const maxScore = item.round_max_score || item.round?.max_score || 100;
    
    roster.forEach((m) => {
      const mId = m.id || m.user_id;
      if (mId) {
        initialScores[mId] = maxScore;
      }
    });
    setMemberScores(initialScores);
  };

  const handleScoreChange = (studentId, scoreVal) => {
    setMemberScores((prev) => ({
      ...prev,
      [studentId]: parseFloat(scoreVal) || 0,
    }));
  };

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedVersion) return;
    if (!feedback.trim()) {
      setError('Evaluation feedback is required.');
      return;
    }

    // Preserve validation requiring a score for every roster member when APPROVED
    const roster = selectedVersion.roster_snapshot || selectedVersion.members || [];
    if (verdict === 'APPROVED' && roster.length > 0) {
      for (const m of roster) {
        const mId = m.id || m.user_id;
        if (memberScores[mId] === undefined || memberScores[mId] === null || isNaN(memberScores[mId])) {
          setError(`Score is required for member ${m.full_name || m.name || m.email || mId}.`);
          return;
        }
      }
    }

    setSubmittingEval(true);
    setError(null);

    try {
      const studentScoresList = Object.entries(memberScores).map(([userId, score]) => ({
        user_id: parseInt(userId, 10) || userId,
        score: Number(score),
      }));

      const payload = {
        verdict: verdict,
        status: verdict,
        feedback: feedback.trim(),
        general_feedback: feedback.trim(),
        student_scores: studentScoresList,
      };

      const versionId = selectedVersion.version_id || selectedVersion.id;
      await reviewApi.evaluateSubmission(versionId, payload);
      setSuccess(`Submission evaluation recorded as ${verdict}.`);
      setSelectedVersion(null);
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to submit evaluation.');
    } finally {
      setSubmittingEval(false);
    }
  };

  const handleReleaseResults = async (versionId) => {
    if (!window.confirm('Release evaluation results to the student group?')) return;
    setError(null);
    try {
      await reviewApi.releaseResults(versionId);
      setSuccess('Results successfully released to group.');
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to release results.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif flex items-center gap-2">
            Submission Review Queue
            <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-sans font-normal">
              {queue.length} Pending
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Claim pending submissions, grade individual group members, send evaluation feedback, and release published scores.
          </p>
        </div>
        <button
          onClick={fetchQueue}
          className="px-3.5 py-2 text-xs font-sans text-slate-300 bg-[#11181C] hover:bg-[#1B262E] rounded-lg border border-[#1B262E] flex items-center gap-2"
        >
          <span>↻ Refresh Queue</span>
        </button>
      </div>

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

      {/* Main Queue Table */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-slate-500">
            Loading review queue...
          </div>
        ) : queue.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-slate-500">
            <p className="text-sm font-semibold text-slate-300">🎉 Queue is Empty!</p>
            <p className="text-slate-500 mt-1">No student submissions are currently awaiting review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0B0F12] text-slate-400 font-mono text-[11px] uppercase border-b border-[#1B262E]">
                <tr>
                  <th className="py-3 px-4">Workspace</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Review Round</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Claim Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B262E]">
                {queue.map((item) => {
                  const versionId = item.version_id || item.id;
                  const isClaimedByMe = item.claimed_by_id === user?.id;
                  const isClaimedByOther = item.claimed_by_id && !isClaimedByMe;
                  const isEvaluated = item.review_status === 'EVALUATED' || item.is_evaluated || item.status === 'APPROVED' || item.status === 'REVISION_REQUESTED';

                  return (
                    <tr key={versionId} className="hover:bg-[#162026] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100">
                          {item.workspace_name || item.workspace_title || 'Workspace'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200">
                          {item.project_name || item.project_title || `Project #${item.project_id}`}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          By: {item.submitter_name || 'Student'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-teal-300">
                        v{item.version_number}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">
                          {item.round_title || item.round_name || `Round ${item.round_id || 1}`}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Max: {item.round_max_score ?? 100} pts • Due: {item.round_due_date ? new Date(item.round_due_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : 'Recent'}
                      </td>
                      <td className="py-3 px-4">
                        {isClaimedByMe ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                            Claimed by you
                          </span>
                        ) : isClaimedByOther ? (
                          <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px]">
                            Claimed ({item.claimed_by_name || `Staff #${item.claimed_by_id}`})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono text-[10px]">
                            Unclaimed
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isClaimedByMe ? (
                          <>
                            <button
                              onClick={() => handleOpenEvaluateModal(item)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded shadow"
                            >
                              Evaluate
                            </button>
                            <button
                              onClick={() => handleReleaseClaim(versionId)}
                              className="px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 rounded font-mono"
                            >
                              Release
                            </button>
                          </>
                        ) : isClaimedByOther ? (
                          <span className="text-slate-500 text-xs italic font-mono">
                            In Review
                          </span>
                        ) : (
                          <button
                            onClick={() => handleClaim(versionId)}
                            className="px-3 py-1.5 bg-teal-600/20 text-teal-300 hover:bg-teal-600/40 border border-teal-500/30 font-semibold text-xs rounded"
                          >
                            Claim for Review
                          </button>
                        )}

                        {isEvaluated && !item.results_released && (
                          <button
                            onClick={() => handleReleaseResults(versionId)}
                            className="px-2.5 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded ml-2 shadow"
                          >
                            Release Results
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Evaluation Modal */}
      {selectedVersion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[#1B262E] pb-4">
              <div>
                <span className="text-xs font-mono text-teal-400 uppercase font-bold">
                  Evaluating Submission v{selectedVersion.version_number}
                </span>
                <h3 className="text-lg font-bold text-slate-100">
                  {selectedVersion.workspace_name || selectedVersion.workspace_title || 'Workspace'} — {selectedVersion.project_name || selectedVersion.project_title || 'Project'}
                </h3>
                <p className="text-xs text-slate-400">
                  Submitted by: <strong className="text-slate-200">{selectedVersion.submitter_name || 'Student'}</strong> • Round: <strong className="text-slate-200">{selectedVersion.round_title || selectedVersion.round_name || 'Round'}</strong> (Max Score: {selectedVersion.round_max_score ?? 100})
                </p>
              </div>
              <button
                onClick={() => setSelectedVersion(null)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Submission Links & Notes */}
            <div className="p-4 rounded-lg bg-[#0B0F12] border border-[#1B262E] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-400">Repository Link:</span>
                {selectedVersion.repo_url || selectedVersion.repository_url ? (
                  <a
                    href={selectedVersion.repo_url || selectedVersion.repository_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <span>🔗 {selectedVersion.repo_url || selectedVersion.repository_url}</span>
                  </a>
                ) : (
                  <span className="text-slate-500 font-mono">No repository URL provided</span>
                )}
              </div>
              {selectedVersion.commit_hash && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400">Commit Hash:</span>
                  <span className="font-mono text-slate-300">{selectedVersion.commit_hash}</span>
                </div>
              )}
              {selectedVersion.submission_notes && (
                <div className="pt-2 border-t border-[#1B262E]">
                  <span className="font-mono text-slate-400 block mb-1">Submission Notes:</span>
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedVersion.submission_notes}</p>
                </div>
              )}
            </div>

            {/* Evaluation Form */}
            <form onSubmit={handleSubmitEvaluation} className="space-y-5">
              {/* Verdict Selection */}
              <div>
                <label className="text-xs font-mono text-slate-400 uppercase block mb-2 font-semibold">
                  Evaluation Verdict
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVerdict('APPROVED')}
                    className={`p-3 rounded-lg border text-xs font-bold font-mono transition-all ${
                      verdict === 'APPROVED'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-[#0B0F12] border-[#1B262E] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ✓ APPROVED
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerdict('REVISION_REQUESTED')}
                    className={`p-3 rounded-lg border text-xs font-bold font-mono transition-all ${
                      verdict === 'REVISION_REQUESTED'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                        : 'bg-[#0B0F12] border-[#1B262E] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⚡ REVISION REQUESTED
                  </button>
                </div>
              </div>

              {/* Individual Roster Member Scoring (Approved verdict only) */}
              {verdict === 'APPROVED' && (
                <div className="p-4 rounded-lg bg-[#0B0F12] border border-[#1B262E] space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-mono text-slate-300 font-bold uppercase">
                      Individual Student Scores
                    </label>
                    <span className="text-[10px] font-mono text-slate-500">
                      Max Score: {selectedVersion.round_max_score ?? 100} pts
                    </span>
                  </div>

                  {(selectedVersion.roster_snapshot || selectedVersion.members || []).length === 0 ? (
                    <div className="text-xs text-slate-500 font-mono">
                      No individual group roster snapshot available. Defaulting group evaluation.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedVersion.roster_snapshot || selectedVersion.members || []).map((student) => {
                        const sId = student.id || student.user_id;
                        return (
                          <div
                            key={sId}
                            className="flex items-center justify-between p-2.5 bg-[#11181C] rounded border border-[#1B262E]"
                          >
                            <div>
                              <div className="text-xs font-semibold text-slate-200">
                                {student.full_name || student.email || `Student #${sId}`}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {student.email}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max={selectedVersion.round_max_score ?? 100}
                                value={memberScores[sId] ?? ''}
                                onChange={(e) => handleScoreChange(sId, e.target.value)}
                                className="w-20 bg-[#0B0F12] border border-[#1B262E] rounded px-2 py-1 text-xs text-slate-200 font-mono text-right focus:outline-none focus:border-teal-500"
                                required={verdict === 'APPROVED'}
                              />
                              <span className="text-xs font-mono text-slate-500">
                                / {selectedVersion.round_max_score ?? 100}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Textarea */}
              <div>
                <label className="text-xs font-mono text-slate-400 uppercase block mb-1 font-semibold">
                  Evaluation Feedback & Remarks (Required)
                </label>
                <textarea
                  rows={4}
                  placeholder="Provide comprehensive feedback, strengths, and necessary improvements..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#1B262E]">
                <button
                  type="button"
                  onClick={() => setSelectedVersion(null)}
                  className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEval}
                  className="px-5 py-2 text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded shadow disabled:opacity-50"
                >
                  {submittingEval ? 'Submitting Evaluation...' : 'Submit Evaluation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
