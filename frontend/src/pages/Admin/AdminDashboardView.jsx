import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboardView = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getDashboard();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Failed to load department statistics.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-[#11181C] to-[#11181C] p-6 rounded-xl border border-amber-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 font-sans">
              Welcome back, {user?.full_name || user?.email}
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
              Administrator
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Departmental operational supervision for {user?.department ? `Department of ${user.department}` : 'All Institutional Workspaces'}.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('workspaces')}
            className="px-4 py-2 bg-[#1B262E] hover:bg-[#24333E] text-slate-200 text-sm font-medium rounded-lg border border-[#2A3B47] transition-all flex items-center gap-2"
          >
            <span>Workspaces</span>
          </button>
          <button
            onClick={() => onNavigate('audit')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-semibold rounded-lg shadow-lg shadow-amber-900/30 transition-all flex items-center gap-2"
          >
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-slate-400 font-mono">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3"></div>
          Aggregating department operations data...
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchStats} className="underline text-xs hover:text-rose-300">Retry</button>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Total Workspaces</span>
                <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg text-xs font-mono">WS</span>
              </div>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-100">{stats.total_workspaces}</div>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-2 font-mono">
                <span className="text-emerald-400">{stats.active_workspaces} Active</span>
                <span>•</span>
                <span className="text-slate-400">{stats.archived_workspaces} Archived</span>
              </div>
            </div>

            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Department Faculty</span>
                <span className="p-2 bg-teal-500/10 text-teal-400 rounded-lg text-xs font-mono">STAFF</span>
              </div>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-100">{stats.total_staff}</div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Assigned across departmental curricula
              </div>
            </div>

            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Enrolled Students</span>
                <span className="p-2 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-mono">STUDENT</span>
              </div>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-100">{stats.total_students}</div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Active group cohort members
              </div>
            </div>

            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Department Projects</span>
                <span className="p-2 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-mono">PROJ</span>
              </div>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-100">{stats.total_projects}</div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Across {stats.total_groups} student project teams
              </div>
            </div>

            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Open Milestones</span>
                <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-mono">ROUNDS</span>
              </div>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-100">{stats.open_review_rounds}</div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Active review rounds accepting deliverables
              </div>
            </div>

            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs uppercase font-mono tracking-wider text-slate-400">Total Submissions</span>
                <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-mono">SUBM</span>
              </div>
              <div className="mt-3 text-3xl font-bold font-mono text-slate-100">{stats.total_submissions}</div>
              <div className="mt-2 text-xs text-slate-500 font-mono">
                Historical project deliverables received
              </div>
            </div>
          </div>

          {/* Quick Management Actions */}
          <div className="p-6 bg-[#11181C] border border-[#1B262E] rounded-xl space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider font-mono text-slate-300">
              Department Operations Center
            </h3>
            <p className="text-xs text-slate-400">
              As an Administrator, you have operational supervision and workspace governance over all departmental entities. Evaluation scoring and grade adjustments remain the sole authority of designated Staff mentors.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              <button
                onClick={() => onNavigate('workspaces')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/30 rounded-lg text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-400">Workspace Management</div>
                <div className="text-[11px] text-slate-500 mt-1">Configure, archive, and manage staff assignments</div>
              </button>

              <button
                onClick={() => onNavigate('projects')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/30 rounded-lg text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-400">Project Monitoring</div>
                <div className="text-[11px] text-slate-500 mt-1">Inspect progress, deliverables, and repositories</div>
              </button>

              <button
                onClick={() => onNavigate('staff')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/30 rounded-lg text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-400">Faculty & Staff</div>
                <div className="text-[11px] text-slate-500 mt-1">Review workloads, assignments, and statuses</div>
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/30 rounded-lg text-left transition-all group"
              >
                <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-400">Reports & Analytics</div>
                <div className="text-[11px] text-slate-500 mt-1">Export operational telemetry and breakdown</div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
