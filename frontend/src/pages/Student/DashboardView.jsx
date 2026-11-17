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
      <div className="p-8 flex items-center justify-center min-h-[300px]">
        <div className="flex items-center gap-3 text-slate-400 font-mono text-xs">
          <div className="w-4 h-4 rounded-full border-2 border-teal-500/20 border-t-teal-400 animate-spin" />
          <span>Loading student workspace data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Welcome Banner */}
      <div className="bg-[#11181C] p-5 rounded-lg border border-[#1B262E] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight font-sans">
              Welcome, {user?.full_name || 'Student'}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold uppercase">
              Student Domain
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Manage your collaborative groups, workspace enrollments, and academic project deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2 font-sans">
          {!group && (
            <button
              onClick={() => onNavigate('groups')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors font-sans"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>Create / Join Group</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-sans">
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Real Core Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
        {/* Metric 1: Group Status */}
        <div className="p-4 rounded-lg bg-[#11181C] border border-[#1B262E] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider">Group Status</span>
            <Users size={14} className="text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-sans">
            {group ? group.name : 'No Active Group'}
          </div>
          <p className="text-xs text-slate-400 font-sans">
            {group ? `${group.member_count} of 5 members active` : 'Join or create a group to enroll'}
          </p>
        </div>

        {/* Metric 2: Enrolled Workspaces */}
        <div className="p-4 rounded-lg bg-[#11181C] border border-[#1B262E] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider">Workspaces</span>
            <Layers size={14} className="text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-sans">
            {workspaces.length} Enrolled
          </div>
          <p className="text-xs text-slate-400 font-sans">
            {workspaces.filter(w => w.is_open).length} active rounds open
          </p>
        </div>

        {/* Metric 3: Active Projects */}
        <div className="p-4 rounded-lg bg-[#11181C] border border-[#1B262E] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider">Projects</span>
            <FolderGit2 size={14} className="text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-sans">
            {workspaces.filter(w => w.has_project).length} Projects
          </div>
          <p className="text-xs text-slate-400 font-sans">
            Derived from current group enrollment
          </p>
        </div>

        {/* Metric 4: Released Results */}
        <div className="p-4 rounded-lg bg-[#11181C] border border-[#1B262E] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider">Released Results</span>
            <CheckCircle2 size={14} className="text-teal-400" />
          </div>
          <div className="text-2xl font-bold text-white font-sans">
            {resultsSummary ? `${resultsSummary.total_earned} / ${resultsSummary.total_possible}` : '0.0 / 0.0'}
          </div>
          <p className="text-xs text-slate-400 font-sans">
            {resultsSummary && resultsSummary.total_possible > 0
              ? `${resultsSummary.cumulative_percentage}% overall marks`
              : 'No results released yet'}
          </p>
        </div>
      </div>

      {/* Main Operations Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
        
        {/* Left Column (8 cols): Workspaces & Projects */}
        <div className="lg:col-span-8 bg-[#11181C] border border-[#1B262E] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#1B262E] pb-3">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm font-sans">Enrolled Workspaces</h3>
              <p className="text-xs text-slate-400 font-sans">Workspaces your group is currently participating in</p>
            </div>
            <button
              onClick={() => onNavigate('workspaces')}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium font-sans inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {workspaces.length === 0 ? (
            <div className="py-8 text-center space-y-2 font-sans">
              <Layers size={24} className="mx-auto text-slate-500" />
              <h4 className="text-xs font-semibold text-white font-sans">No Enrolled Workspaces</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto font-sans">
                {group && group.member_count >= 2
                  ? 'Your group has at least 2 members! Enroll into a course workspace using the Workspace ID provided by your instructor.'
                  : group
                  ? 'Your group currently has 1 member. A group must have at least 2 members before enrolling into a workspace.'
                  : 'Create or join a group first, then enroll into academic course workspaces.'}
              </p>
              <button
                onClick={() => onNavigate('groups')}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-medium hover:bg-teal-500/30 transition-colors font-sans"
              >
                <span>Go to Group Management</span>
                <ArrowRight size={13} />
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 font-sans">
              {workspaces.map((ws) => (
                <div
                  key={ws.id}
                  className="p-3.5 rounded bg-[#0E1317] border border-[#1B262E] hover:border-slate-600 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                        {ws.id}
                      </span>
                      <h4 className="text-xs font-bold text-white truncate font-sans">{ws.name}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-sans">
                      <span>Term: {ws.term}</span>
                      <span>·</span>
                      <span>{ws.review_rounds?.length || 0} Review Rounds</span>
                      {ws.notices?.length > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-teal-400">{ws.notices.length} Notices</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-sans">
                    {ws.has_project ? (
                      <button
                        onClick={() => onNavigate('projects')}
                        className="px-2.5 py-1 rounded bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-medium transition-colors font-sans"
                      >
                        Open Project
                      </button>
                    ) : (
                      <button
                        onClick={() => onNavigate('projects')}
                        className="px-2.5 py-1 rounded bg-[#161F26] hover:bg-[#1E2B35] border border-[#1B262E] text-slate-200 text-xs font-medium transition-colors font-sans"
                      >
                        Create Project
                      </button>
                    )}
                    <button
                      onClick={() => onNavigate('workspaces')}
                      className="px-2.5 py-1 rounded bg-[#161F26] hover:bg-[#1E2B35] border border-[#1B262E] text-slate-300 text-xs font-medium transition-colors font-sans"
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
        <div className="lg:col-span-4 bg-[#11181C] border border-[#1B262E] rounded-lg p-5 space-y-4 font-sans">
          <div className="flex items-center justify-between border-b border-[#1B262E] pb-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-sans">My Group</h3>
            {group && (
              <span className="px-2 py-0.5 rounded text-[11px] font-sans font-semibold bg-teal-950/80 text-teal-400 border border-teal-500/30">
                {group.member_count} / 5
              </span>
            )}
          </div>

          {group ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-white font-sans">{group.name}</h4>
                <p className="text-[11px] text-slate-400 font-sans">Collaborative Student Team</p>
              </div>

              {/* Group Code box */}
              <div className="p-2.5 rounded bg-[#0E1317] border border-[#1B262E] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase block">Group Join Code</span>
                  <span className="text-xs font-mono font-bold text-teal-300 tracking-wider">{group.code}</span>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="p-1 rounded bg-[#161F26] hover:bg-[#1E2B35] border border-[#1B262E] text-slate-300 hover:text-white transition-colors"
                  title="Copy group code"
                >
                  {copiedCode ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
                </button>
              </div>

              {/* Members list */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-sans font-semibold text-slate-400 uppercase tracking-wider block">Active Members</span>
                <div className="space-y-1">
                  {group.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#0E1317] font-sans">
                      <span className="text-slate-200 font-medium">{m.full_name}</span>
                      <span className="text-[10px] font-sans text-slate-500">Member</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => onNavigate('groups')}
                className="w-full py-1.5 rounded bg-[#161F26] hover:bg-[#1E2B35] border border-[#1B262E] text-xs text-slate-300 hover:text-white font-medium transition-colors font-sans mt-2"
              >
                Manage Group
              </button>
            </div>
          ) : (
            <div className="py-4 text-center space-y-2 font-sans">
              <p className="text-xs text-slate-400">You are not currently enrolled in any student project group.</p>
              <button
                onClick={() => onNavigate('groups')}
                className="px-3 py-1.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-medium hover:bg-teal-500/30 transition-colors"
              >
                Join or Create Group
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DashboardView;
