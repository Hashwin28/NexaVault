import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { useAuth } from '../../context/AuthContext';
import { Layers, Users, GraduationCap, FolderGit2, Calendar, FileText, ArrowRight } from 'lucide-react';

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
    <div className="space-y-6">
      {/* Welcome Institutional Banner */}
      <div className="bg-[#11181C] p-5 rounded-lg border border-[#1B262E] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-100 font-sans">
              Welcome back, {user?.full_name || user?.email}
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold uppercase">
              Administrator
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Departmental operational supervision for {user?.department ? `Department of ${user.department}` : 'All Institutional Workspaces'}.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('workspaces')}
            className="px-3.5 py-1.5 bg-[#161F26] hover:bg-[#1E2B35] text-slate-200 text-xs font-medium rounded border border-[#1B262E] transition-colors"
          >
            Workspaces
          </button>
          <button
            onClick={() => onNavigate('audit')}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
          >
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-slate-400 font-mono text-xs">
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3"></div>
          Aggregating department operations data...
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchStats} className="underline text-xs hover:text-rose-300">Retry</button>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-lg">
              <div className="flex justify-between items-start">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Total Workspaces</span>
                <Layers size={14} className="text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{stats.total_workspaces}</div>
              <div className="mt-1.5 text-xs text-slate-500 flex items-center gap-2 font-mono">
                <span className="text-emerald-400">{stats.active_workspaces} Active</span>
                <span>·</span>
                <span className="text-slate-400">{stats.archived_workspaces} Archived</span>
              </div>
            </div>

            <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-lg">
              <div className="flex justify-between items-start">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Department Faculty</span>
                <Users size={14} className="text-teal-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{stats.total_staff}</div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono">
                Assigned across departmental curricula
              </div>
            </div>

            <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-lg">
              <div className="flex justify-between items-start">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Enrolled Students</span>
                <GraduationCap size={14} className="text-blue-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{stats.total_students}</div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono">
                Active group cohort members
              </div>
            </div>

            <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-lg">
              <div className="flex justify-between items-start">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Department Projects</span>
                <FolderGit2 size={14} className="text-purple-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{stats.total_projects}</div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono">
                Across {stats.total_groups} student project teams
              </div>
            </div>

            <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-lg">
              <div className="flex justify-between items-start">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Open Milestones</span>
                <Calendar size={14} className="text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{stats.open_review_rounds}</div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono">
                Active review rounds accepting deliverables
              </div>
            </div>

            <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-lg">
              <div className="flex justify-between items-start">
                <span className="text-[11px] uppercase font-mono tracking-wider text-slate-400">Total Submissions</span>
                <FileText size={14} className="text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-100">{stats.total_submissions}</div>
              <div className="mt-1.5 text-xs text-slate-500 font-mono">
                Historical project deliverables received
              </div>
            </div>
          </div>

          {/* Quick Management Actions */}
          <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-lg space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-slate-300">
              Department Operations Center
            </h3>
            <p className="text-xs text-slate-400">
              As an Administrator, you have operational supervision and workspace governance over all departmental entities. Evaluation scoring and grade adjustments remain the sole authority of designated Staff mentors.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <button
                onClick={() => onNavigate('workspaces')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/40 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">Workspace Management</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Configure, archive, and manage staff</div>
              </button>

              <button
                onClick={() => onNavigate('projects')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/40 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">Project Monitoring</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Inspect progress and repositories</div>
              </button>

              <button
                onClick={() => onNavigate('staff')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/40 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">Faculty & Staff</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Review workloads and assignments</div>
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="p-3 bg-[#0B0F12] border border-[#1B262E] hover:border-amber-500/40 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">Reports & Analytics</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Operational telemetry breakdown</div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboardView;
