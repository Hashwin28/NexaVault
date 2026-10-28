import React, { useState, useEffect } from 'react';
import { reviewApi } from '../../api/reviewApi';
import { useAuth } from '../../context/AuthContext';

export const StaffReviewQueueView = () => {
  const { user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING', 'IN_REVIEW', 'EVALUATED', 'PUBLISHED', 'ALL'

  // Active evaluation modal state
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [verdict, setVerdict] = useState('APPROVED'); // 'APPROVED' or 'REVISION_REQUESTED'
  const [feedback, setFeedback] = useState('');
  const [memberScores, setMemberScores] = useState({});
  const [submittingEval, setSubmittingEval] = useState(false);

  // Confirmation modal for publishing results
  const [confirmPublishVersion, setConfirmPublishVersion] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchQueue(statusFilter);
  }, [statusFilter]);

  const fetchQueue = async (overrideFilter) => {
    const filter = overrideFilter !== undefined ? overrideFilter : statusFilter;
    setLoading(true);
    setError(null);
    try {
      const data = await reviewApi.getQueue(filter);
      setQueue(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load review queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReview = async (versionId) => {
    setError(null);
    try {
      await reviewApi.claimSubmission(versionId);
      setSuccess('Started review. Submission lock acquired.');
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to start review.');
    }
  };

  const handleReleaseReviewLock = async (versionId) => {
    setError(null);
    try {
      await reviewApi.releaseClaim(versionId);
      setSuccess('Review lock released back to queue.');
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to release lock.');
    }
  };

  const handleOpenEvaluateModal = (item) => {
    setSelectedVersion(item);
    setVerdict(item.evaluation_verdict || 'APPROVED');
    setFeedback(item.evaluation_feedback || '');
    
    // Initialize member scores from existing scores or defaults
    const initialScores = {};
    const roster = item.roster_snapshot || [];
    const maxScore = item.round_max_score != null ? Number(item.round_max_score) : 100;
    
    // Check if there are existing recorded scores
    const existingScoresMap = {};
    if (item.scores && Array.isArray(item.scores)) {
      item.scores.forEach((s) => {
        existingScoresMap[s.student_id] = s.score;
      });
    }

    roster.forEach((m) => {
      const mId = m.id || m.user_id;
      if (mId) {
        if (existingScoresMap[mId] !== undefined) {
          initialScores[mId] = existingScoresMap[mId];
        } else {
          initialScores[mId] = maxScore;
        }
      }
    });
    setMemberScores(initialScores);
  };

  const handleScoreChange = (studentId, scoreVal) => {
    setMemberScores((prev) => ({
      ...prev,
      [studentId]: scoreVal === '' ? '' : parseFloat(scoreVal),
    }));
  };

  const handleSubmitEvaluation = async (e) => {
    e.preventDefault();
    if (!selectedVersion) return;
    if (!feedback.trim()) {
      setError('Evaluation feedback is required.');
      return;
    }

    const roster = selectedVersion.roster_snapshot || [];
    const maxScore = selectedVersion.round_max_score != null ? Number(selectedVersion.round_max_score) : 100;

    if (verdict === 'APPROVED' && roster.length > 0) {
      for (const m of roster) {
        const mId = m.id || m.user_id;
        const sVal = memberScores[mId];
        if (sVal === undefined || sVal === null || sVal === '' || isNaN(Number(sVal))) {
          setError(`Marks are required for member ${m.full_name || m.name || m.email || mId}.`);
          return;
        }
        const numVal = Number(sVal);
        if (numVal < 0 || numVal > maxScore) {
          setError(`Marks ${numVal} for ${m.full_name || m.name || mId} must be between 0 and ${maxScore}.`);
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
        feedback: feedback.trim(),
        student_scores: studentScoresList,
      };

      const versionId = selectedVersion.version_id || selectedVersion.id;
      await reviewApi.evaluateSubmission(versionId, payload);
      setSuccess(`Evaluation saved as ${verdict}. Marks are saved as draft until explicitly published.`);
      setSelectedVersion(null);
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to save evaluation.');
    } finally {
      setSubmittingEval(false);
    }
  };

  const handleExecutePublish = async () => {
    if (!confirmPublishVersion) return;
    setPublishing(true);
    setError(null);
    const versionId = confirmPublishVersion.version_id || confirmPublishVersion.id;
    try {
      await reviewApi.releaseResults(versionId);
      setSuccess(`Results published successfully! Students can now view their official marks.`);
      setConfirmPublishVersion(null);
      await fetchQueue();
    } catch (err) {
      setError(err.message || 'Failed to publish results.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif flex items-center gap-2">
            Submission Review Queue
            <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-sans font-normal">
              {queue.length} Submissions
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Structured 6-step review workflow: Pending Review → Start Review → Enter Marks → Save Draft → Publish Results → Published.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#11181C] p-1 rounded-lg border border-[#1B262E]">
            {[
              { id: 'PENDING', label: '1. Pending Review' },
              { id: 'IN_REVIEW', label: '2. In Review' },
              { id: 'EVALUATED', label: '3. Evaluated (Draft)' },
              { id: 'PUBLISHED', label: '4. Published' },
              { id: 'ALL', label: 'All' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-sans transition-all ${
                  statusFilter === tab.id
                    ? 'bg-teal-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchQueue(statusFilter)}
            className="px-3.5 py-1.5 text-xs font-sans text-slate-300 bg-[#11181C] hover:bg-[#1B262E] rounded-lg border border-[#1B262E] flex items-center gap-1.5 transition-colors"
          >
            <span>↻ Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 font-bold ml-2">×</button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 font-bold ml-2">×</button>
        </div>
      )}

      {/* Main Review Queue Table */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-slate-500">
            Loading review queue...
          </div>
        ) : queue.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-slate-500">
            <p className="text-sm font-semibold text-slate-300">🎉 Queue is Empty!</p>
            <p className="text-slate-500 mt-1">
              {statusFilter === 'PENDING' && 'No student submissions are currently awaiting review.'}
              {statusFilter === 'IN_REVIEW' && 'No submissions are currently claimed or in review.'}
              {statusFilter === 'EVALUATED' && 'No draft evaluations pending publication.'}
              {statusFilter === 'PUBLISHED' && 'No published results found in this view.'}
              {statusFilter === 'ALL' && 'No submissions found in your assigned workspaces.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0B0F12] text-slate-400 font-mono text-[11px] uppercase border-b border-[#1B262E]">
                <tr>
                  <th className="py-3 px-4">Workspace & Project</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Round & Version</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Review State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B262E]">
                {queue.map((item) => {
                  const versionId = item.version_id || item.id;
                  const isClaimedByMe = item.claimed_by_id === user?.id;
                  const isClaimedByOther = item.claimed_by_id && !isClaimedByMe;
                  const isEvaluated = item.status === 'APPROVED' || item.status === 'REVISION_REQUESTED';
                  const isPublished = item.results_released;

                  return (
                    <tr key={versionId} className="hover:bg-[#162026] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-100">
                          {item.project_name || `Project #${item.project_id}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.workspace_name || item.workspace_id}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">
                          {item.group_name || `Group #${item.group_id || 'N/A'}`}
                        </div>
                        {item.group_code && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            Code: {item.group_code}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          By: {item.submitter_name || 'Student'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-200 font-medium flex items-center gap-1.5">
                          <span>{item.round_title}</span>
                          <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            v{item.version_number}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Max: {item.round_max_score ?? 100} pts
                          {item.is_late && <span className="text-rose-400 font-bold ml-1.5">• LATE</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : 'Recent'}
                      </td>
                      <td className="py-3.5 px-4">
                        {isPublished ? (
                          <span className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold">
                            ✓ Published to Students
                          </span>
                        ) : isEvaluated ? (
                          <span className="px-2.5 py-1 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[10px] font-bold">
                            Evaluated (Draft Marks)
                          </span>
                        ) : isClaimedByMe ? (
                          <span className="px-2.5 py-1 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 font-mono text-[10px] font-bold">
                            In Review by You
                          </span>
                        ) : isClaimedByOther ? (
                          <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono text-[10px]">
                            Locked by {item.claimed_by_name || `Staff #${item.claimed_by_id}`}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded bg-slate-800/80 text-slate-400 border border-slate-700 font-mono text-[10px]">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {/* Step 1: Claim */}
                          {!item.claimed_by_id && !isEvaluated && !isPublished && (
                            <button
                              onClick={() => handleStartReview(versionId)}
                              className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded shadow transition-all"
                            >
                              Start Review
                            </button>
                          )}

                          {/* Step 2: In Review by Current Staff */}
                          {isClaimedByMe && !isEvaluated && (
                            <>
                              <button
                                onClick={() => handleOpenEvaluateModal(item)}
                                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded shadow transition-all"
                              >
                                Enter Marks & Feedback
                              </button>
                              <button
                                onClick={() => handleReleaseReviewLock(versionId)}
                                className="px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 rounded border border-amber-500/20 font-mono"
                                title="Release lock back to other faculty"
                              >
                                Release Lock
                              </button>
                            </>
                          )}

                          {/* Step 3: Evaluated (Draft Marks) */}
                          {isEvaluated && !isPublished && (
                            <>
                              <button
                                onClick={() => handleOpenEvaluateModal(item)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs rounded border border-slate-700"
                              >
                                Edit Marks
                              </button>
                              <button
                                onClick={() => setConfirmPublishVersion(item)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded shadow transition-all"
                              >
                                Publish Results
                              </button>
                            </>
                          )}

                          {/* Step 4: Published */}
                          {isPublished && (
                            <button
                              onClick={() => handleOpenEvaluateModal(item)}
                              className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-mono text-xs rounded border border-slate-700"
                            >
                              View Evaluation
                            </button>
                          )}

                          {isClaimedByOther && !isEvaluated && !isPublished && (
                            <span className="text-slate-500 text-xs italic font-mono">
                              In Review
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Publishing Results */}
      {confirmPublishVersion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-lg mb-3">
                📢
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Publish Results to Students?
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                You are about to publish official marks for{' '}
                <strong className="text-slate-200">
                  {confirmPublishVersion.project_name} ({confirmPublishVersion.round_title})
                </strong>.
              </p>
              <div className="mt-3 p-3 rounded-lg bg-[#0B0F12] border border-[#1B262E] text-xs text-slate-300 space-y-1">
                <p>• Marks will immediately become visible to enrolled group students.</p>
                <p>• Students will see their individual score and faculty feedback.</p>
                <p>• Progress metrics will reflect these published results.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#1B262E]">
              <button
                type="button"
                onClick={() => setConfirmPublishVersion(null)}
                disabled={publishing}
                className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePublish}
                disabled={publishing}
                className="px-5 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow disabled:opacity-50 transition-all"
              >
                {publishing ? 'Publishing Results...' : 'Confirm & Publish Results'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation & Marks Modal */}
      {selectedVersion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-[#1B262E] pb-4">
              <div>
                <span className="text-xs font-mono text-teal-400 uppercase font-bold">
                  Evaluating Submission v{selectedVersion.version_number}
                </span>
                <h3 className="text-lg font-bold text-slate-100">
                  {selectedVersion.project_name || 'Project'} — {selectedVersion.workspace_name || 'Workspace'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Group: <strong className="text-slate-200">{selectedVersion.group_name || 'Group'}</strong> • Round: <strong className="text-slate-200">{selectedVersion.round_title}</strong> (Max: {selectedVersion.round_max_score ?? 100} marks)
                </p>
              </div>
              <button
                onClick={() => setSelectedVersion(null)}
                className="text-slate-400 hover:text-slate-200 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Submission Deliverable Details */}
            <div className="p-4 rounded-lg bg-[#0B0F12] border border-[#1B262E] space-y-2.5 text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                Student Deliverables
              </span>
              
              <div className="flex items-center justify-between">
                <span className="font-mono text-slate-400">Deliverable / Link:</span>
                {selectedVersion.deliverable_link ? (
                  <a
                    href={selectedVersion.deliverable_link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <span>🔗 {selectedVersion.deliverable_link}</span>
                  </a>
                ) : (
                  <span className="text-slate-500 font-mono">No external link provided</span>
                )}
              </div>

              {selectedVersion.github_commit_sha && (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-slate-400">Commit SHA:</span>
                  <span className="font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {selectedVersion.github_commit_sha}
                  </span>
                </div>
              )}

              {selectedVersion.submission_notes && (
                <div className="pt-2 border-t border-[#1B262E]">
                  <span className="font-mono text-slate-400 block mb-1">Student Notes:</span>
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedVersion.submission_notes}</p>
                </div>
              )}
            </div>

            {/* Evaluation Form */}
            <form onSubmit={handleSubmitEvaluation} className="space-y-5">
              {/* Verdict Selection */}
              <div>
                <label className="text-xs font-mono text-slate-400 uppercase block mb-2 font-semibold">
                  Review Verdict
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
                    ✓ APPROVED & SCORE
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
                      Individual Student Marks
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      Permitted Range: 0 to {selectedVersion.round_max_score ?? 100} marks
                    </span>
                  </div>

                  {(selectedVersion.roster_snapshot || []).length === 0 ? (
                    <div className="text-xs text-slate-500 font-mono">
                      No group roster snapshot found.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedVersion.roster_snapshot || []).map((student) => {
                        const sId = student.id || student.user_id;
                        const maxScore = selectedVersion.round_max_score ?? 100;
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
                                max={maxScore}
                                value={memberScores[sId] ?? ''}
                                onChange={(e) => handleScoreChange(sId, e.target.value)}
                                className="w-24 bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1 text-xs text-slate-200 font-mono text-right focus:outline-none focus:border-teal-500"
                                placeholder="Marks"
                                required={verdict === 'APPROVED'}
                              />
                              <span className="text-xs font-mono text-slate-400">
                                / {maxScore}
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
                  placeholder="Provide constructive evaluation feedback, strengths, and necessary corrections..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 leading-relaxed"
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-3 border-t border-[#1B262E]">
                <span className="text-[11px] text-slate-500 font-mono">
                  Saved marks remain draft until you click "Publish Results".
                </span>
                <div className="flex gap-3">
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
                    className="px-5 py-2 text-xs bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded shadow disabled:opacity-50 transition-all"
                  >
                    {submittingEval ? 'Saving...' : 'Save Evaluation (Draft Marks)'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
