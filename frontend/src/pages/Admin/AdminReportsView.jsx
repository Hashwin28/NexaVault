import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

export const AdminReportsView = () => {
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getReports();
      setReports(data);
    } catch (err) {
      setError(err.message || 'Failed to generate operational reports.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-100">Department Operational Reports</h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated operational analytics, curriculum distribution, and deliverable milestones telemetry.
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="px-3 py-1.5 bg-[#1B262E] hover:bg-[#24333E] text-slate-300 text-xs font-mono rounded border border-[#2A3B47]"
        >
          Refresh Telemetry
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
          Aggregating department analytics from database...
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
          {error}
        </div>
      )}

      {!loading && reports && (
        <div className="space-y-6">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Workspaces Breakdown */}
            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-400 font-semibold">
                Workspace Operational Status
              </h3>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Active Curricula</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {reports.workspaces_by_status?.active ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Archived Workspaces</div>
                  <div className="text-2xl font-bold font-mono text-slate-400 mt-1">
                    {reports.workspaces_by_status?.archived ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Deliverable Review Status */}
            <div className="p-5 bg-[#11181C] border border-[#1B262E] rounded-xl space-y-3">
              <h3 className="text-xs font-mono uppercase text-slate-400 font-semibold">
                Deliverable Submissions Status
              </h3>
              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Submitted</div>
                  <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                    {reports.submission_status?.submitted ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">In Review</div>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {reports.submission_status?.in_review ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Evaluated</div>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {reports.submission_status?.reviewed ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Table: Projects per Workspace */}
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden space-y-3 p-5">
            <h3 className="text-xs font-mono uppercase text-slate-300 font-semibold">
              Project Distribution Across Curricula
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Workspace</th>
                    <th className="p-3">Workspace ID</th>
                    <th className="p-3 text-right">Active Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B262E]">
                  {reports.projects_by_workspace?.length > 0 ? (
                    reports.projects_by_workspace.map((item) => (
                      <tr key={item.workspace_id} className="hover:bg-[#162026]">
                        <td className="p-3 font-semibold text-slate-200">{item.workspace_name}</td>
                        <td className="p-3 font-mono text-slate-400">{item.workspace_id}</td>
                        <td className="p-3 text-right font-mono font-bold text-amber-400">
                          {item.project_count}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500 font-mono">
                        No projects recorded in department workspaces.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Faculty Workspace Assignments */}
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden space-y-3 p-5">
            <h3 className="text-xs font-mono uppercase text-slate-300 font-semibold">
              Faculty Workload & Workspace Assignments
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Faculty Member</th>
                    <th className="p-3 text-right">Assigned Workspaces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B262E]">
                  {reports.staff_assignments?.length > 0 ? (
                    reports.staff_assignments.map((item) => (
                      <tr key={item.staff_id} className="hover:bg-[#162026]">
                        <td className="p-3 font-semibold text-slate-200">{item.staff_name}</td>
                        <td className="p-3 text-right font-mono font-bold text-teal-400">
                          {item.workspace_count}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-slate-500 font-mono">
                        No faculty assignments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table: Review Round Milestones */}
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden space-y-3 p-5">
            <h3 className="text-xs font-mono uppercase text-slate-300 font-semibold">
              Review Round Lifecycle Across Workspaces
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Workspace</th>
                    <th className="p-3 text-center">Open Rounds</th>
                    <th className="p-3 text-center">Concluded Rounds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B262E]">
                  {reports.review_round_completion?.length > 0 ? (
                    reports.review_round_completion.map((item) => (
                      <tr key={item.workspace_id} className="hover:bg-[#162026]">
                        <td className="p-3 font-mono text-slate-300">{item.workspace_id}</td>
                        <td className="p-3 text-center font-mono text-emerald-400">{item.open_rounds}</td>
                        <td className="p-3 text-center font-mono text-slate-400">{item.closed_rounds}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-500 font-mono">
                        No review rounds configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
