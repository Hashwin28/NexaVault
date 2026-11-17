import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

export const AdminProjectsView = ({ initialProjectId }) => {
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected project detail
  const [selectedProject, setSelectedProject] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const limit = 10;

  useEffect(() => {
    // Load workspace list for filtering
    adminApi.getWorkspaces({ limit: 100 }).then((res) => {
      setWorkspaces(res.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [page, selectedWorkspaceId]);

  useEffect(() => {
    if (initialProjectId) {
      loadProjectDetail(initialProjectId);
    }
  }, [initialProjectId]);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        workspace_id: selectedWorkspaceId || undefined,
        search: search.trim() || undefined,
      };
      const res = await adminApi.getProjects(params);
      setProjects(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch projects.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchProjects();
  };

  const loadProjectDetail = async (id) => {
    setDetailLoading(true);
    try {
      const proj = await adminApi.getProject(id);
      setSelectedProject(proj);
    } catch (err) {
      alert(`Could not load project: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold font-sans text-slate-100">Project Monitoring</h2>
        <p className="text-xs text-slate-400 mt-1">
          Departmental operational visibility into student deliverables, group milestones, and progress telemetry.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by title or group name..."
            className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded-lg px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500/40 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#1B262E] hover:bg-[#24333E] text-slate-200 text-xs font-medium rounded-lg border border-[#2A3B47]"
          >
            Search
          </button>
        </form>

        <select
          value={selectedWorkspaceId}
          onChange={(e) => { setSelectedWorkspaceId(e.target.value); setPage(1); }}
          className="bg-[#0B0F12] border border-[#1B262E] rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
        >
          <option value="">All Department Workspaces</option>
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.id})
            </option>
          ))}
        </select>
      </div>

      {/* Projects Table and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={selectedProject ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
          {loading && (
            <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
              Loading projects...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
              {error}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
              No projects found for the selected workspace.
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Project</th>
                      <th className="p-3.5">Workspace</th>
                      <th className="p-3.5">Group</th>
                      <th className="p-3.5">Deliverables</th>
                      <th className="p-3.5">Progress</th>
                      <th className="p-3.5">GitHub</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B262E]">
                    {projects.map((proj) => {
                      const isSelected = selectedProject?.id === proj.id;
                      const progressPct = proj.custom_progress !== null && proj.custom_progress !== undefined
                        ? Math.round(proj.custom_progress)
                        : null;
                      return (
                        <tr
                          key={proj.id}
                          onClick={() => loadProjectDetail(proj.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-500/10 border-l-2 border-l-amber-400' : 'hover:bg-[#162026]'
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{proj.name}</div>
                            <div className="font-mono text-[10px] text-slate-500">ID #{proj.id}</div>
                          </td>
                          <td className="p-3.5 font-mono text-slate-300">
                            {proj.workspace_name || proj.workspace_id}
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {proj.group_name || `Group #${proj.group_id}`}
                          </td>
                          <td className="p-3.5 font-mono text-slate-400">
                            {proj.submission_count} submissions
                          </td>
                          <td className="p-3.5">
                            {progressPct !== null ? (
                              <div className="w-24">
                                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                                  <span>{progressPct}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#1B262E] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-amber-400 rounded-full"
                                    style={{ width: `${Math.min(100, progressPct)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {proj.has_github ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                Linked
                              </span>
                            ) : (
                              <span className="text-slate-600 font-mono text-[10px]">None</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); loadProjectDetail(proj.id); }}
                              className="px-2.5 py-1 bg-[#1B262E] hover:bg-[#24333E] text-slate-300 rounded text-[11px]"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3.5 bg-[#0B0F12] border-t border-[#1B262E] flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Showing {projects.length} of {total} projects</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-[#1B262E] disabled:opacity-30 hover:bg-[#24333E] rounded text-slate-300 text-xs"
                  >
                    Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 bg-[#1B262E] disabled:opacity-30 hover:bg-[#24333E] rounded text-slate-300 text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Project Detail Panel */}
        {selectedProject && (
          <div className="lg:col-span-5 bg-[#11181C] border border-[#1B262E] rounded-xl p-5 space-y-5">
            <div className="flex justify-between items-start border-b border-[#1B262E] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">
                  Project Inspection
                </span>
                <h3 className="text-base font-bold text-slate-100">{selectedProject.name}</h3>
                <div className="font-mono text-xs text-slate-400">
                  {selectedProject.workspace_name} • Group: {selectedProject.group_name}
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                Loading project details...
              </div>
            ) : (
              <>
                {/* Description */}
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 font-semibold mb-1">
                    Description
                  </h4>
                  <p className="text-xs text-slate-300 bg-[#0B0F12] p-3 rounded border border-[#1B262E]">
                    {selectedProject.description || 'No description provided.'}
                  </p>
                </div>

                {/* Team Members */}
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 font-semibold mb-2">
                    Group Members ({selectedProject.members?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedProject.members?.length > 0 ? (
                      selectedProject.members.map((m) => (
                        <div
                          key={m.id}
                          className="p-2 bg-[#0B0F12] rounded border border-[#1B262E] flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="font-medium text-slate-200">{m.full_name}</span>
                            {m.roll_number && (
                              <span className="ml-2 font-mono text-[10px] text-amber-400/80">({m.roll_number})</span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">{m.email}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 font-mono">No member records found.</div>
                    )}
                  </div>
                </div>

                {/* Review Rounds & Submissions */}
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 font-semibold mb-2">
                    Deliverables & Milestones
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedProject.rounds?.length > 0 ? (
                      selectedProject.rounds.map((r) => (
                        <div
                          key={r.round_id}
                          className="p-2.5 bg-[#0B0F12] rounded border border-[#1B262E] flex justify-between items-center text-xs"
                        >
                          <div>
                            <div className="font-semibold text-slate-200">{r.round_title}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Weight: {r.weight}% • Due: {new Date(r.due_date).toLocaleDateString()}
                            </div>
                          </div>
                          <div>
                            {r.submitted ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Submitted (v{r.version_number || 1})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-500/10 text-slate-500">
                                Awaiting Submission
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 font-mono">No review rounds configured in workspace.</div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Policy Note:</span> Academic evaluations, scoring rubrics, and grade modifications are restricted to assigned Staff evaluators.
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


export default AdminProjectsView;
