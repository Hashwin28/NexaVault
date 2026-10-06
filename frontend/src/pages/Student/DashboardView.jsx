import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Layers, 
  FolderGit2, 
  CheckCircle2, 
  ArrowRight, 
  Plus, 
  AlertCircle,
  Copy,
  Check,
  Calendar,
  FileText
} from 'lucide-react';
import { groupApi } from '../../api/groupApi';
import { workspaceApi } from '../../api/workspaceApi';
import { resultApi } from '../../api/resultApi';
import { useAuth } from '../../context/AuthContext';

export const DashboardView = ({ onNavigate }) => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [resultsSummary, setResultsSummary] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setLoading(true);
      setError(null);

      try {
        // Parallel fetch of real backend endpoints
        const [groupRes, wsRes, resultsRes] = await Promise.allSettled([
          groupApi.getMyGroup(),
          workspaceApi.getMyWorkspaces(),
          resultApi.getMyResults(),
        ]);

        if (!isMounted) return;

        if (groupRes.status === 'fulfilled') {
          setGroup(groupRes.value);
        } else {
          setGroup(null);
        }

        if (wsRes.status === 'fulfilled') {
          setWorkspaces(wsRes.value || []);
        } else {
          setWorkspaces([]);
        }

        if (resultsRes.status === 'fulfilled') {
          setResultsSummary(resultsRes.value || null);
        } else {
          setResultsSummary(null);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCode = () => {
    if (group?.code) {
      navigator.clipboard.writeText(group.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading student workspace core...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-vault-border/40">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">
            Welcome, {user?.full_name || 'Student'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Academic Vault active. Manage your collaborative groups, workspace enrollments, and deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!group && (
            <button
              onClick={() => onNavigate('groups')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold shadow-sm transition-all"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Create / Join Group</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Real Core Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Group Status */}
        <div className="p-5 rounded-xl bg-vault-surface border border-vault-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Group Status</span>
            <Users size={16} className="text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {group ? group.name : 'No Active Group'}
          </div>
          <p className="text-[11px] text-slate-400">
            {group ? `${group.member_count} of 5 members active` : 'Join or create a group to enroll'}
          </p>
        </div>

        {/* Metric 2: Enrolled Workspaces */}
        <div className="p-5 rounded-xl bg-vault-surface border border-vault-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Workspaces</span>
            <Layers size={16} className="text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {workspaces.length} Enrolled
          </div>
          <p className="text-[11px] text-slate-400">
            {workspaces.filter(w => w.is_open).length} active rounds open
          </p>
        </div>

        {/* Metric 3: Active Projects */}
        <div className="p-5 rounded-xl bg-vault-surface border border-vault-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Projects</span>
            <FolderGit2 size={16} className="text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {workspaces.filter(w => w.has_project).length} Projects
          </div>
          <p className="text-[11px] text-slate-400">
            Derived from current group enrollment
          </p>
        </div>

        {/* Metric 4: Released Results */}
        <div className="p-5 rounded-xl bg-vault-surface border border-vault-border/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Released Results</span>
            <CheckCircle2 size={16} className="text-teal-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {resultsSummary ? `${resultsSummary.total_earned} / ${resultsSummary.total_possible}` : '0.0 / 0.0'}
          </div>
          <p className="text-[11px] text-slate-400">
            {resultsSummary && resultsSummary.total_possible > 0
              ? `${resultsSummary.cumulative_percentage}% overall marks`
              : 'No results released yet'}
          </p>
        </div>
      </div>

      {/* Main Operations Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (8 cols): Workspaces & Projects */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white font-display">Enrolled Workspaces</h3>
              <p className="text-xs text-slate-400">Workspaces your group is currently participating in</p>
            </div>
            <button
              onClick={() => onNavigate('workspaces')}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="p-8 rounded-xl bg-vault-surface/60 border border-vault-border/60 text-center space-y-3">
              <Layers size={28} className="mx-auto text-slate-500" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">No Enrolled Workspaces</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {group && group.member_count >= 2
                    ? 'Your group has at least 2 members! Enroll into a course workspace using the Workspace ID provided by your instructor.'
                    : group
                    ? 'Your group currently has 1 member. A group must have at least 2 members before enrolling into a workspace.'
                    : 'Create or join a group first, then enroll into academic course workspaces.'}
                </p>
              </div>
              <button
                onClick={() => onNavigate('groups')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-medium hover:bg-teal-500/30 transition-colors"
              >
                <span>Go to Group Management</span>
                <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="p-5 rounded-xl bg-vault-surface border border-vault-border/60 hover:border-teal-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                        {ws.id}
                      </span>
                      <h4 className="text-sm font-bold text-white truncate">{ws.name}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>Term: {ws.term}</span>
                      <span>•</span>
                      <span>{ws.review_rounds?.length || 0} Review Rounds</span>
                      {ws.notices?.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-teal-400">{ws.notices.length} Notices</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ws.has_project ? (
                      <button
                        onClick={() => onNavigate('projects')}
                        className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-medium transition-colors"
                      >
                        Open Project
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate('projects')}
                        className="px-3 py-1.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-200 text-xs font-medium transition-colors"
                      >
                        Create Project
                      </button>
                    )}
                    <button
                      onClick={() => onNavigate('workspaces')}
                      className="px-3 py-1.5 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-slate-300 text-xs font-medium transition-colors"
                    >
                      Workspace
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Active Group Card & Quick Info */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-xl bg-vault-surface border border-vault-border/60 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">My Group</h3>
              {group && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-950/80 text-teal-400 border border-teal-500/30">
                  {group.member_count} / 5
                </span>
              )}
            </div>

            {group ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-white">{group.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Leaderless Equal Collaborative Team</p>
                </div>

                {/* Group Code box */}
                <div className="p-3 rounded-lg bg-vault-canvas border border-vault-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Group Join Code</span>
                    <span className="text-sm font-mono font-bold text-teal-300 tracking-wider">{group.code}</span>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 rounded bg-vault-surface hover:bg-vault-elevated border border-vault-border text-slate-300 hover:text-white transition-colors"
                    title="Copy group code"
                  >
                    {copiedCode ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Members list */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">Active Members</span>
                  <div className="space-y-1.5">
                    {group.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-vault-canvas/60">
                        <span className="text-slate-200 font-medium">{m.full_name}</span>
                        <span className="text-[10px] font-mono text-slate-400">Equal</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onNavigate('groups')}
                  className="w-full py-2 rounded-lg bg-vault-canvas hover:bg-vault-elevated border border-vault-border text-xs text-slate-300 hover:text-white font-medium transition-colors"
                >
                  Manage Group
                </button>
              </div>
            ) : (
              <div className="py-4 text-center space-y-3">
                <p className="text-xs text-slate-400">You do not currently belong to any active group.</p>
                <button
                  onClick={() => onNavigate('groups')}
                  className="w-full py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-colors"
                >
                  Create or Join Group
                </button>
              </div>
            )}
          </div>

          {/* Quick Guidance Box */}
          <div className="p-5 rounded-xl bg-teal-950/20 border border-teal-500/20 text-xs text-slate-300 space-y-2">
            <h4 className="font-semibold text-teal-300 flex items-center gap-1.5">
              <FileText size={14} />
              <span>NexaVault Evaluation Model</span>
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Progress is dynamically calculated from approved Review Rounds. Individual scores are recorded on frozen roster snapshots upon deliverable approval.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
