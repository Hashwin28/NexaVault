import React, { useEffect, useState } from 'react';
import { workspaceApi } from '../../api/workspaceApi';
import { reviewApi } from '../../api/reviewApi';
import { useAuth } from '../../context/AuthContext';

export const StaffDashboardView = ({ onNavigate }) => {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, queueRes] = await Promise.all([
        workspaceApi.getMyWorkspaces().catch(() => []),
        reviewApi.getQueue().catch(() => []),
      ]);
      setWorkspaces(wsRes || []);
      setReviewQueue(queueRes || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch staff dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSubmission = async (versionId) => {
    try {
      await reviewApi.claimSubmission(versionId);
      await fetchDashboardData();
      onNavigate('review-queue');
    } catch (err) {
      alert(`Claim failed: ${err.message}`);
    }
  };

  const myClaimedSubmissions = reviewQueue.filter(
    (item) => item.claimed_by_id === user?.id
  );
  const unclaimedSubmissions = reviewQueue.filter(
    (item) => !item.claimed_by_id
  );

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-950/40 via-[#11181C] to-[#11181C] p-6 rounded-xl border border-teal-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-sans flex items-center gap-2">
            Welcome back, {user?.full_name || user?.email}
            <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-sans font-normal">
              Staff Portal
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Real-time management dashboard for academic workspaces, student groups, and review queues.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('workspaces')}
            className="px-4 py-2 bg-[#1B262E] hover:bg-[#24333E] text-slate-200 text-sm font-medium rounded-lg border border-[#2A3B47] transition-all flex items-center gap-2"
          >
            <span>Manage Workspaces</span>
          </button>
          <button
            onClick={() => onNavigate('review-queue')}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 text-sm font-semibold rounded-lg shadow-lg shadow-teal-900/30 transition-all flex items-center gap-2"
          >
            <span>Review Queue</span>
            <span className="bg-slate-950/30 px-1.5 py-0.5 rounded text-xs font-sans">
              {reviewQueue.length}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-2">
          <div className="text-xs font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Managed Workspaces</span>
            <span className="text-teal-400">❖</span>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-sans">
            {loading ? '...' : workspaces.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            {workspaces.filter((w) => w.owner_id === user?.id).length} Owner / {workspaces.filter((w) => w.owner_id !== user?.id).length} Co-Staff
          </p>
        </div>

        <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-2">
          <div className="text-xs font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Submissions Pending Review</span>
            <span className="text-amber-400">⏳</span>
          </div>
          <div className="text-2xl font-bold text-amber-300 font-sans">
            {loading ? '...' : reviewQueue.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Across all managed workspaces
          </p>
        </div>

        <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-2">
          <div className="text-xs font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Unclaimed Queue</span>
            <span className="text-teal-400">📥</span>
          </div>
          <div className="text-2xl font-bold text-teal-400 font-sans">
            {loading ? '...' : unclaimedSubmissions.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Ready for staff assignment
          </p>
        </div>

        <div className="bg-[#11181C] p-5 rounded-xl border border-[#1B262E] space-y-2">
          <div className="text-xs font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>My Claimed Submissions</span>
            <span className="text-emerald-400">✍</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-sans">
            {loading ? '...' : myClaimedSubmissions.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Currently claimed by you
          </p>
        </div>
      </div>

      {/* Main Grid: Managed Workspaces & Urgent Review Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Managed Workspaces Overview */}
        <div className="lg:col-span-1 bg-[#11181C] rounded-xl border border-[#1B262E] p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-200 font-sans">
              Your Managed Workspaces
            </h3>
            <button
              onClick={() => onNavigate('workspaces')}
              className="text-xs text-teal-400 hover:underline font-sans"
            >
              View All →
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs font-sans text-slate-500">
              Loading workspaces...
            </div>
          ) : workspaces.length === 0 ? (
            <div className="py-8 text-center text-xs font-sans text-slate-500 border border-dashed border-[#1B262E] rounded-lg p-4">
              No workspaces created or joined yet.
              <button
                onClick={() => onNavigate('workspaces')}
                className="block mx-auto mt-3 px-3 py-1.5 text-xs bg-teal-600/20 text-teal-300 rounded border border-teal-500/30 font-sans"
              >
                + Create Workspace
              </button>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[380px] pr-1">
              {workspaces.map((ws) => {
                const isOwner = ws.owner_id === user?.id;
                return (
                  <div
                    key={ws.id}
                    className="p-4 rounded-lg bg-[#0B0F12] border border-[#1B262E] hover:border-teal-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-200 truncate">
                        {ws.title}
                      </h4>
                      <span
                        className={`text-[10px] font-sans px-2 py-0.5 rounded border uppercase shrink-0 ${
                          isOwner
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                        }`}
                      >
                        {isOwner ? 'Owner' : 'Co-Staff'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2">
                      {ws.description || 'No description provided.'}
                    </p>

                    <div className="pt-2 flex items-center justify-between text-xs text-slate-500 font-sans border-t border-[#1B262E]">
                      <span className="font-mono">ID: {ws.id}</span>
                      <button
                        onClick={() => onNavigate('workspaces', ws.id)}
                        className="text-teal-400 hover:text-teal-300 font-semibold font-sans"
                      >
                        Open Workspace →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Review Queue Preview */}
        <div className="lg:col-span-2 bg-[#11181C] rounded-xl border border-[#1B262E] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-200 font-sans">
                Submissions Needing Review
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Sorted by Review Round due date and submission timestamp.
              </p>
            </div>
            <button
              onClick={() => onNavigate('review-queue')}
              className="text-xs text-teal-400 hover:underline font-sans"
            >
              Open Full Queue ({reviewQueue.length}) →
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs font-sans text-slate-500">
              Loading review queue...
            </div>
          ) : reviewQueue.length === 0 ? (
            <div className="py-12 text-center text-xs font-sans text-slate-500 border border-dashed border-[#1B262E] rounded-lg">
              <p>🎉 All pending submissions have been evaluated!</p>
              <p className="text-slate-600 mt-1">No pending versions in review queue.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300 font-sans">
                <thead className="bg-[#0B0F12] text-slate-400 font-sans text-[11px] uppercase border-b border-[#1B262E]">
                  <tr>
                    <th className="py-3 px-3">Workspace / Group</th>
                    <th className="py-3 px-3">Version</th>
                    <th className="py-3 px-3">Round</th>
                    <th className="py-3 px-3">Submitted</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B262E]">
                  {reviewQueue.slice(0, 5).map((item) => {
                    const isClaimedByMe = item.claimed_by_id === user?.id;
                    const isClaimedByOther = item.claimed_by_id && !isClaimedByMe;

                    return (
                      <tr key={item.version_id || item.id} className="hover:bg-[#162026]">
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-200">
                            {item.workspace_name || item.workspace_title || 'Workspace'}
                          </div>
                          <div className="text-[11px] text-slate-400 font-sans">
                            Project: <span className="text-slate-300 font-medium">{item.project_name || 'Project'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-teal-400">
                          v{item.version_number}
                        </td>
                        <td className="py-3 px-3">
                          <div className="text-slate-200 font-medium">
                            {item.round_title || item.round_name || `Round ${item.round_id || 1}`}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item.round_due_date ? `Due: ${new Date(item.round_due_date).toLocaleDateString()}` : 'Active'}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3 px-3">
                          {isClaimedByMe ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
                              Claimed by you
                            </span>
                          ) : isClaimedByOther ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px]">
                              Claimed ({item.claimed_by_name || `Staff #${item.claimed_by_id}`})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono text-[10px]">
                              Unclaimed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {isClaimedByMe ? (
                            <button
                              onClick={() => onNavigate('review-queue')}
                              className="px-2.5 py-1 text-xs bg-emerald-600 text-slate-950 font-semibold rounded hover:bg-emerald-500"
                            >
                              Evaluate →
                            </button>
                          ) : isClaimedByOther ? (
                            <span className="text-slate-500 text-xs">Locked</span>
                          ) : (
                            <button
                              onClick={() => handleClaimSubmission(item.version_id)}
                              className="px-2.5 py-1 text-xs bg-teal-600/20 text-teal-300 border border-teal-500/30 rounded hover:bg-teal-600/40"
                            >
                              Claim
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
      </div>
    </div>
  );
};
