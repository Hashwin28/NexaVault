import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

export const AdminWorkspacesView = ({ initialWorkspaceId, onNavigate }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterArchived, setFilterArchived] = useState('all'); // 'all', 'active', 'archived'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected workspace detail
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editConfig, setEditConfig] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  // Staff assignment modal
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Archive modal
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Status feedback
  const [actionSuccess, setActionSuccess] = useState(null);

  const limit = 10;

  useEffect(() => {
    fetchWorkspaces();
  }, [page, filterArchived]);

  useEffect(() => {
    if (initialWorkspaceId) {
      loadWorkspaceDetail(initialWorkspaceId);
    }
  }, [initialWorkspaceId]);

  const fetchWorkspaces = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        search: search.trim() || undefined,
      };
      if (filterArchived === 'active') params.is_archived = false;
      if (filterArchived === 'archived') params.is_archived = true;

      const res = await adminApi.getWorkspaces(params);
      setWorkspaces(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch workspaces.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchWorkspaces();
  };

  const loadWorkspaceDetail = async (id) => {
    setDetailLoading(true);
    try {
      const ws = await adminApi.getWorkspace(id);
      setSelectedWorkspace(ws);
      setEditConfig({
        name: ws.name || '',
        description: ws.description || '',
        term: ws.term || '',
        department: ws.department || '',
        is_open: ws.is_open ?? true,
      });

      // Load available staff for assignment
      const staffRes = await adminApi.getStaff({ limit: 100 });
      setStaffList(staffRes.items || []);
    } catch (err) {
      alert(`Could not load workspace: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!selectedWorkspace) return;
    setSaveLoading(true);
    try {
      const updated = await adminApi.updateWorkspace(selectedWorkspace.id, editConfig);
      setSelectedWorkspace((prev) => ({ ...prev, ...updated }));
      setActionSuccess('Workspace configuration successfully updated.');
      fetchWorkspaces();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleArchiveWorkspace = async () => {
    if (!selectedWorkspace) return;
    setArchiveLoading(true);
    try {
      await adminApi.archiveWorkspace(selectedWorkspace.id, archiveReason);
      setArchiveModalOpen(false);
      setArchiveReason('');
      setActionSuccess(`Workspace '${selectedWorkspace.id}' has been archived.`);
      loadWorkspaceDetail(selectedWorkspace.id);
      fetchWorkspaces();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(`Archive failed: ${err.message}`);
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleUnarchiveWorkspace = async () => {
    if (!selectedWorkspace) return;
    if (!confirm(`Are you sure you want to unarchive workspace ${selectedWorkspace.id}?`)) return;
    try {
      await adminApi.unarchiveWorkspace(selectedWorkspace.id);
      setActionSuccess(`Workspace '${selectedWorkspace.id}' has been restored to active status.`);
      loadWorkspaceDetail(selectedWorkspace.id);
      fetchWorkspaces();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(`Unarchive failed: ${err.message}`);
    }
  };

  const handleAssignStaff = async (e) => {
    e.preventDefault();
    if (!selectedWorkspace || !selectedStaffId) return;
    setAssignLoading(true);
    try {
      await adminApi.assignStaff(selectedWorkspace.id, parseInt(selectedStaffId, 10));
      setActionSuccess('Staff member successfully assigned to workspace.');
      setSelectedStaffId('');
      loadWorkspaceDetail(selectedWorkspace.id);
      fetchWorkspaces();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(`Staff assignment failed: ${err.message}`);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveStaff = async (userId, staffName) => {
    if (!confirm(`Revoke workspace staff authorization for ${staffName}?`)) return;
    try {
      await adminApi.removeStaff(selectedWorkspace.id, userId);
      setActionSuccess(`Revoked staff access for ${staffName}.`);
      loadWorkspaceDetail(selectedWorkspace.id);
      fetchWorkspaces();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(`Remove staff failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Filter Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-slate-100">Department Workspaces</h2>
          <p className="text-xs text-slate-400 mt-1">
            Department-wide directory of curriculum workspaces, assigned faculty, and operational states.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 bg-[#11181C] p-1 rounded-lg border border-[#1B262E]">
          <button
            onClick={() => { setFilterArchived('all'); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              filterArchived === 'all'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Workspaces
          </button>
          <button
            onClick={() => { setFilterArchived('active'); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              filterArchived === 'active'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => { setFilterArchived('archived'); setPage(1); }}
            className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
              filterArchived === 'archived'
                ? 'bg-slate-500/20 text-slate-300 font-semibold border border-slate-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Archived
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-200">×</button>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by workspace name, ID, or term..."
          className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
        />
        <button
          type="submit"
          className="px-5 py-2.5 bg-[#1B262E] hover:bg-[#24333E] text-slate-200 text-sm font-medium rounded-lg border border-[#2A3B47] transition-all"
        >
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setPage(1); fetchWorkspaces(); }}
            className="px-3 py-2.5 bg-[#11181C] hover:bg-[#1B262E] text-slate-400 text-xs rounded-lg"
          >
            Clear
          </button>
        )}
      </form>

      {/* Main Table and Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Workspace List (left or full) */}
        <div className={selectedWorkspace ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
          {loading && (
            <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
              Loading workspaces...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
              {error}
            </div>
          )}

          {!loading && workspaces.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
              No workspaces found matching the criteria.
            </div>
          )}

          {!loading && workspaces.length > 0 && (
            <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Workspace</th>
                      <th className="p-3.5">Term</th>
                      <th className="p-3.5">Owner / Faculty</th>
                      <th className="p-3.5">Staff</th>
                      <th className="p-3.5">Groups</th>
                      <th className="p-3.5">Projects</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B262E]">
                    {workspaces.map((ws) => {
                      const isSelected = selectedWorkspace?.id === ws.id;
                      return (
                        <tr
                          key={ws.id}
                          onClick={() => loadWorkspaceDetail(ws.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/10 border-l-2 border-l-amber-400'
                              : 'hover:bg-[#162026]'
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{ws.name}</div>
                            <div className="font-mono text-[11px] text-amber-400/80">{ws.id}</div>
                          </td>
                          <td className="p-3.5 font-mono text-slate-300">{ws.term}</td>
                          <td className="p-3.5 text-slate-300">{ws.owner_name || `User #${ws.owner_id}`}</td>
                          <td className="p-3.5 font-mono text-slate-400">{ws.staff_count ?? '—'}</td>
                          <td className="p-3.5 font-mono text-slate-400">{ws.group_count ?? '—'}</td>
                          <td className="p-3.5 font-mono text-slate-400">{ws.project_count ?? '—'}</td>
                          <td className="p-3.5">
                            {ws.is_archived ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                Archived
                              </span>
                            ) : ws.is_open ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Closed
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); loadWorkspaceDetail(ws.id); }}
                              className="px-2.5 py-1 bg-[#1B262E] hover:bg-[#24333E] text-slate-300 rounded text-[11px] transition-all"
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-3.5 bg-[#0B0F12] border-t border-[#1B262E] flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Showing {workspaces.length} of {total} workspaces</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 bg-[#1B262E] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#24333E] rounded text-slate-300 text-xs"
                  >
                    Prev
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 bg-[#1B262E] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#24333E] rounded text-slate-300 text-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Workspace Detail & Management Panel (right) */}
        {selectedWorkspace && (
          <div className="lg:col-span-5 bg-[#11181C] border border-[#1B262E] rounded-xl p-5 space-y-6">
            <div className="flex justify-between items-start border-b border-[#1B262E] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">
                  Operational Governance
                </span>
                <h3 className="text-base font-bold text-slate-100">{selectedWorkspace.name}</h3>
                <div className="font-mono text-xs text-slate-400">{selectedWorkspace.id}</div>
              </div>
              <button
                onClick={() => setSelectedWorkspace(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                Loading details...
              </div>
            ) : (
              <>
                {/* Configuration Edit Form */}
                <form onSubmit={handleSaveConfig} className="space-y-3">
                  <h4 className="text-xs font-mono uppercase text-slate-300 font-semibold">
                    Workspace Configuration
                  </h4>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={editConfig?.name || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, name: e.target.value })}
                      required
                      className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editConfig?.description || ''}
                      onChange={(e) => setEditConfig({ ...editConfig, description: e.target.value })}
                      className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Academic Term</label>
                      <input
                        type="text"
                        value={editConfig?.term || ''}
                        onChange={(e) => setEditConfig({ ...editConfig, term: e.target.value })}
                        required
                        className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">Department</label>
                      <input
                        type="text"
                        value={editConfig?.department || ''}
                        onChange={(e) => setEditConfig({ ...editConfig, department: e.target.value })}
                        placeholder="e.g. CS"
                        className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="is_open_checkbox"
                      checked={editConfig?.is_open ?? true}
                      onChange={(e) => setEditConfig({ ...editConfig, is_open: e.target.checked })}
                      className="rounded bg-[#0B0F12] border-[#1B262E] text-amber-500 focus:ring-0"
                    />
                    <label htmlFor="is_open_checkbox" className="text-xs text-slate-300">
                      Submissions Open (Active Enrollment)
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={saveLoading}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded transition-all"
                    >
                      {saveLoading ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                </form>

                {/* Faculty & Staff Assignment */}
                <div className="space-y-3 pt-3 border-t border-[#1B262E]">
                  <h4 className="text-xs font-mono uppercase text-slate-300 font-semibold">
                    Assigned Faculty & Staff
                  </h4>

                  {/* Assign new staff form */}
                  <form onSubmit={handleAssignStaff} className="flex gap-2">
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
                    >
                      <option value="">Select Faculty to Assign...</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.full_name} ({st.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={!selectedStaffId || assignLoading}
                      className="px-3 py-1.5 bg-[#1B262E] hover:bg-[#24333E] disabled:opacity-40 text-slate-200 rounded text-xs font-medium"
                    >
                      {assignLoading ? '...' : 'Assign'}
                    </button>
                  </form>

                  {/* Staff List */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedWorkspace.staff_members?.length > 0 ? (
                      selectedWorkspace.staff_members.map((sm) => {
                        const isOwner = sm.user_id === selectedWorkspace.owner_id || sm.role === 'owner';
                        return (
                          <div
                            key={sm.id || sm.user_id}
                            className="p-2 bg-[#0B0F12] rounded border border-[#1B262E] flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold text-slate-200">
                                {sm.user_name || `User #${sm.user_id}`}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {sm.user_email || `ID: ${sm.user_id}`} • {isOwner ? 'Workspace Owner' : 'Co-Staff'}
                              </div>
                            </div>
                            {!isOwner && (
                              <button
                                onClick={() => handleRemoveStaff(sm.user_id, sm.user_name || `User #${sm.user_id}`)}
                                className="px-2 py-0.5 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-slate-500 text-xs font-mono">
                        Owner: {selectedWorkspace.owner_name || `User #${selectedWorkspace.owner_id}`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Workspace Lifecycle Interventions */}
                <div className="pt-3 border-t border-[#1B262E] space-y-2">
                  <h4 className="text-xs font-mono uppercase text-slate-300 font-semibold">
                    Administrative Lifecycle
                  </h4>
                  {selectedWorkspace.is_archived ? (
                    <button
                      onClick={handleUnarchiveWorkspace}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs rounded transition-all"
                    >
                      Unarchive & Reopen Workspace
                    </button>
                  ) : (
                    <button
                      onClick={() => setArchiveModalOpen(true)}
                      className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs rounded transition-all"
                    >
                      Archive Workspace
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Archive Reason Confirmation Modal */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold font-sans text-rose-400">
              Confirm Workspace Archival
            </h3>
            <p className="text-xs text-slate-400">
              Archiving workspace <span className="font-mono text-slate-200">{selectedWorkspace?.name}</span> will set it to read-only. Students and staff will no longer be able to submit deliverables or release evaluations.
            </p>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Administrative Justification / Reason (Required for Audit Trail)
              </label>
              <textarea
                rows={3}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="State the administrative reason for archiving this workspace..."
                className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:border-rose-500/40 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setArchiveModalOpen(false); setArchiveReason(''); }}
                className="px-4 py-2 bg-[#1B262E] text-slate-300 text-xs rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!archiveReason.trim() || archiveLoading}
                onClick={handleArchiveWorkspace}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-slate-100 font-semibold text-xs rounded"
              >
                {archiveLoading ? 'Archiving...' : 'Confirm Archival'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default AdminWorkspacesView;
