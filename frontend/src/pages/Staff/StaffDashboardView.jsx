import React, { useEffect, useState } from 'react';
import { workspaceApi } from '../../api/workspaceApi';
import { reviewApi } from '../../api/reviewApi';
import { useAuth } from '../../context/AuthContext';
import { Layers, Clock, Inbox, CheckCircle2, ArrowRight } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Welcome Institutional Banner */}
      <div className="bg-[#11181C] p-5 rounded-lg border border-[#1B262E] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 font-sans">
              Welcome back, {user?.full_name || user?.email}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold uppercase">
              Staff Portal
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Real-time management dashboard for academic workspaces, student groups, and review queues.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('workspaces')}
            className="px-3.5 py-1.5 bg-[#161F26] hover:bg-[#1E2B35] text-slate-200 text-xs font-medium rounded border border-[#1B262E] transition-colors"
          >
            Manage Workspaces
          </button>
          <button
            onClick={() => onNavigate('review-queue')}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
          >
            <span>Review Queue</span>
            <span className="bg-slate-950/30 px-1.5 py-0.5 rounded text-[10px]">
              {reviewQueue.length}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11181C] p-4 rounded-lg border border-[#1B262E] space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Managed Workspaces</span>
            <Layers size={14} className="text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-sans">
            {loading ? '...' : workspaces.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            {workspaces.filter((w) => w.owner_id === user?.id).length} Owner · {workspaces.filter((w) => w.owner_id !== user?.id).length} Co-Staff
          </p>
        </div>

        <div className="bg-[#11181C] p-4 rounded-lg border border-[#1B262E] space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Pending Review</span>
            <Clock size={14} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-sans">
            {loading ? '...' : reviewQueue.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Across all managed workspaces
          </p>
        </div>

        <div className="bg-[#11181C] p-4 rounded-lg border border-[#1B262E] space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>Unclaimed Queue</span>
            <Inbox size={14} className="text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-teal-400 font-sans">
            {loading ? '...' : unclaimedSubmissions.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Ready for staff assignment
          </p>
        </div>

        <div className="bg-[#11181C] p-4 rounded-lg border border-[#1B262E] space-y-1.5">
          <div className="text-[11px] font-sans text-slate-400 uppercase tracking-wider flex justify-between items-center">
            <span>My Active Claims</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-sans">
            {loading ? '...' : myClaimedSubmissions.length}
          </div>
          <p className="text-xs text-slate-500 font-sans">
            Claimed by your account
          </p>
        </div>
      </div>

      {/* Main Grid: Workspaces Summary + Quick Review Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Active Managed Workspaces */}
        <div className="lg:col-span-7 bg-[#11181C] border border-[#1B262E] rounded-lg p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1B262E] pb-3">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm font-sans">Managed Workspaces</h3>
              <p className="text-xs text-slate-400">Workspaces where you have administrative or evaluation duties</p>
            </div>
            <button
              onClick={() => onNavigate('workspaces')}
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1 font-medium"
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading workspaces...</div>
          ) : workspaces.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No workspaces assigned yet. Create a workspace or contact an administrator.
            </div>
          ) : (
            <div className="space-y-2.5">
              {workspaces.slice(0, 5).map((ws) => (
                <div
                  key={ws.id}
                  onClick={() => onNavigate('workspaces', ws.id)}
                  className="p-3 bg-[#0E1317] hover:bg-[#161F26] border border-[#1B262E] rounded-md cursor-pointer transition-colors flex justify-between items-center"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-teal-400 font-semibold">{ws.id}</span>
                      <span className="text-xs font-semibold text-slate-200">{ws.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Term: {ws.term || 'N/A'} · Rounds: {ws.review_rounds?.length || 0}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                    ws.is_open ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {ws.is_open ? 'ACTIVE' : 'LOCKED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Priority Submissions */}
        <div className="lg:col-span-5 bg-[#11181C] border border-[#1B262E] rounded-lg p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-[#1B262E] pb-3">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm font-sans">Review Queue Priority</h3>
              <p className="text-xs text-slate-400">Latest student deliverables awaiting review</p>
            </div>
            <button
              onClick={() => onNavigate('review-queue')}
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors flex items-center gap-1 font-medium"
            >
              <span>Queue</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading queue...</div>
          ) : reviewQueue.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Review queue is clear. No pending submissions.
            </div>
          ) : (
            <div className="space-y-2.5">
              {reviewQueue.slice(0, 5).map((sub) => (
                <div
                  key={sub.version_id}
                  className="p-3 bg-[#0E1317] border border-[#1B262E] rounded-md flex justify-between items-center"
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {sub.project_title || `Project #${sub.project_id}`}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      v{sub.version_number} · Round {sub.round_number}
                    </div>
                  </div>
                  <div>
                    {!sub.claimed_by_id ? (
                      <button
                        onClick={() => handleClaimSubmission(sub.version_id)}
                        className="px-2.5 py-1 text-xs bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded transition-colors"
                      >
                        Claim
                      </button>
                    ) : (
                      <span className="text-[10px] text-amber-400 font-mono">Claimed</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboardView;
