import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

export const AdminStudentsView = ({ onNavigate }) => {
  const [students, setStudents] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected student detail
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Status intervention modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  // Notification feedback
  const [actionSuccess, setActionSuccess] = useState(null);

  const limit = 10;

  useEffect(() => {
    adminApi.getWorkspaces({ limit: 100 }).then((res) => {
      setWorkspaces(res.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [page, selectedWorkspaceId]);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        workspace_id: selectedWorkspaceId || undefined,
        search: search.trim() || undefined,
      };
      const res = await adminApi.getStudents(params);
      setStudents(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch students.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  const loadStudentDetail = async (id) => {
    setDetailLoading(true);
    try {
      const data = await adminApi.getStudent(id);
      setSelectedStudent(data);
    } catch (err) {
      alert(`Could not load student detail: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChangeConfirm = async () => {
    if (!selectedStudent) return;
    setStatusLoading(true);
    try {
      await adminApi.updateUserStatus(selectedStudent.id, targetStatus, statusReason);
      setStatusModalOpen(false);
      setStatusReason('');
      setActionSuccess(`Account status updated for ${selectedStudent.full_name}.`);
      loadStudentDetail(selectedStudent.id);
      fetchStudents();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold font-sans text-slate-100">Student Directory & Governance</h2>
        <p className="text-xs text-slate-400 mt-1">
          Departmental student registry, group affiliations, enrolled curricula, and operational standing.
        </p>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-xs flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-slate-400 hover:text-slate-200">×</button>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students by name, email, or roll number..."
            className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded-lg px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500/40 focus:outline-none"
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

      {/* Table & Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={selectedStudent ? 'lg:col-span-7 space-y-4' : 'lg:col-span-12 space-y-4'}>
          {loading && (
            <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
              Loading student roster...
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs">
              {error}
            </div>
          )}

          {!loading && students.length === 0 && (
            <div className="p-12 text-center text-slate-500 font-mono text-sm bg-[#11181C] rounded-xl border border-[#1B262E]">
              No student records found matching the search criteria.
            </div>
          )}

          {!loading && students.length > 0 && (
            <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Student</th>
                      <th className="p-3.5">Roll Number</th>
                      <th className="p-3.5">Group</th>
                      <th className="p-3.5">Curricula</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1B262E]">
                    {students.map((st) => {
                      const isSelected = selectedStudent?.id === st.id;
                      return (
                        <tr
                          key={st.id}
                          onClick={() => loadStudentDetail(st.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-500/10 border-l-2 border-l-amber-400' : 'hover:bg-[#162026]'
                          }`}
                        >
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{st.full_name}</div>
                            <div className="font-mono text-[11px] text-slate-500">{st.email}</div>
                          </td>
                          <td className="p-3.5 font-mono text-amber-400 font-medium">
                            {st.roll_number || '—'}
                          </td>
                          <td className="p-3.5 text-slate-300">
                            {st.group_name || 'No Group'}
                          </td>
                          <td className="p-3.5 font-mono text-slate-400">
                            {st.workspace_count} workspaces
                          </td>
                          <td className="p-3.5">
                            {st.is_active ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Suspended
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); loadStudentDetail(st.id); }}
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
                <span>Showing {students.length} of {total} students</span>
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

        {/* Selected Student Detail Panel */}
        {selectedStudent && (
          <div className="lg:col-span-5 bg-[#11181C] border border-[#1B262E] rounded-xl p-5 space-y-5">
            <div className="flex justify-between items-start border-b border-[#1B262E] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 tracking-wider">
                  Student Record
                </span>
                <h3 className="text-base font-bold text-slate-100">{selectedStudent.full_name}</h3>
                <div className="font-mono text-xs text-slate-400">{selectedStudent.email}</div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                Loading student details...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-[#0B0F12] rounded border border-[#1B262E]">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Roll Number</div>
                    <div className="font-semibold text-amber-400 mt-0.5">{selectedStudent.roll_number || 'Unassigned'}</div>
                  </div>
                  <div className="p-2.5 bg-[#0B0F12] rounded border border-[#1B262E]">
                    <div className="text-[10px] font-mono text-slate-500 uppercase">Account Status</div>
                    <div className="font-semibold text-slate-200 mt-0.5">
                      {selectedStudent.is_active ? 'Active' : 'Suspended'}
                    </div>
                  </div>
                </div>

                {/* Group Affiliation */}
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-300 font-semibold mb-2">
                    Project Group Affiliation
                  </h4>
                  {selectedStudent.group_id ? (
                    <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] space-y-1">
                      <div className="font-semibold text-slate-200 text-xs">
                        {selectedStudent.group_name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Group ID #{selectedStudent.group_id}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-[#0B0F12] rounded border border-[#1B262E] text-xs text-slate-500 font-mono">
                      Student is not currently enrolled in an active project group.
                    </div>
                  )}
                </div>

                {/* Account Status Intervention */}
                <div className="pt-3 border-t border-[#1B262E]">
                  <h4 className="text-xs font-mono uppercase text-slate-300 font-semibold mb-2">
                    Account Status Intervention
                  </h4>
                  {selectedStudent.is_active ? (
                    <button
                      onClick={() => { setTargetStatus(false); setStatusModalOpen(true); }}
                      className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs rounded transition-all"
                    >
                      Suspend Student Account
                    </button>
                  ) : (
                    <button
                      onClick={() => { setTargetStatus(true); setStatusModalOpen(true); }}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs rounded transition-all"
                    >
                      Reactivate Student Account
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Account Status Modal */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11181C] border border-[#1B262E] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-sm font-bold font-sans text-slate-100">
              Confirm {targetStatus ? 'Reactivation' : 'Suspension'} for {selectedStudent?.full_name}
            </h3>
            <p className="text-xs text-slate-400">
              {targetStatus
                ? 'Reactivating this account will restore portal login privileges.'
                : 'Suspending this account will immediately revoke access to project submissions and group participation.'}
            </p>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                Administrative Justification / Reason (Recorded in Audit Trail)
              </label>
              <textarea
                rows={3}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="State the reason for this administrative account action..."
                className="w-full bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setStatusModalOpen(false); setStatusReason(''); }}
                className="px-4 py-2 bg-[#1B262E] text-slate-300 text-xs rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusLoading}
                onClick={handleStatusChangeConfirm}
                className={`px-4 py-2 font-semibold text-xs rounded text-slate-950 ${
                  targetStatus ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-rose-500 hover:bg-rose-400'
                }`}
              >
                {statusLoading ? 'Processing...' : `Confirm ${targetStatus ? 'Reactivation' : 'Suspension'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export default AdminStudentsView;
