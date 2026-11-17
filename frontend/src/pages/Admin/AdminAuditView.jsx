import React, { useState, useEffect } from 'react';
import { adminApi } from '../../api/adminApi';

export const AdminAuditView = () => {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active filters
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [timeRange, setTimeRange] = useState('all');
  const [search, setSearch] = useState('');

  // Expanded row for details
  const [expandedEventId, setExpandedEventId] = useState(null);

  const limit = 25;

  useEffect(() => {
    // Load dynamic filter choices
    adminApi.getAuditFilters().then((f) => setFilters(f)).catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
  }, [selectedWorkspace, timeRange]);

  useEffect(() => {
    fetchAuditFeed();
  }, [page, selectedWorkspace, selectedCategory, selectedStatus, timeRange]);

  const fetchStats = async () => {
    try {
      const data = await adminApi.getAuditStats({
        workspace_id: selectedWorkspace || undefined,
        time_range: timeRange,
      });
      setStats(data);
    } catch {}
  };

  const fetchAuditFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        limit,
        offset: (page - 1) * limit,
        workspace_id: selectedWorkspace || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
        time_range: timeRange,
        search: search.trim() || undefined,
      };
      const res = await adminApi.getAudit(params);
      setEvents(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit activity feed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchAuditFeed();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold font-sans text-slate-100">Department Audit Trail</h2>
        <p className="text-xs text-slate-400 mt-1">
          Cryptographically referenced, immutable chronological activity log across all departmental entities and administration events.
        </p>
      </div>

      {/* Aggregate Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 bg-[#11181C] border border-[#1B262E] rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Total Logged Events</div>
            <div className="mt-1 text-2xl font-bold font-mono text-slate-100">{stats.total_events}</div>
          </div>
          <div className="p-3.5 bg-[#11181C] border border-[#1B262E] rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Workspace Actions</div>
            <div className="mt-1 text-2xl font-bold font-mono text-teal-400">{stats.workspace_changes}</div>
          </div>
          <div className="p-3.5 bg-[#11181C] border border-[#1B262E] rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Access & Staff</div>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-400">{stats.access_changes}</div>
          </div>
          <div className="p-3.5 bg-[#11181C] border border-[#1B262E] rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Security Incidents</div>
            <div className="mt-1 text-2xl font-bold font-mono text-purple-400">{stats.security_events}</div>
          </div>
          <div className="p-3.5 bg-[#11181C] border border-[#1B262E] rounded-xl">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Failed Operations</div>
            <div className={`mt-1 text-2xl font-bold font-mono ${stats.failure_count > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {stats.failure_count}
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 bg-[#11181C] border border-[#1B262E] rounded-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Workspace select */}
          <select
            value={selectedWorkspace}
            onChange={(e) => { setSelectedWorkspace(e.target.value); setPage(1); }}
            className="bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
          >
            <option value="">All Department Workspaces</option>
            {filters?.workspaces?.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.label}</option>
            ))}
          </select>

          {/* Category */}
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            className="bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="WORKSPACE">Workspace</option>
            <option value="ACCESS">Access & Staff</option>
            <option value="ADMIN">Administrative</option>
            <option value="SECURITY">Security</option>
            <option value="ASSESSMENT">Assessment</option>
            <option value="PROJECT">Project</option>
          </select>

          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
            className="bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
          >
            <option value="ALL">All Outcomes</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILURE">Failures / Denied Only</option>
          </select>

          {/* Time range */}
          <select
            value={timeRange}
            onChange={(e) => { setTimeRange(e.target.value); setPage(1); }}
            className="bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 focus:border-amber-500/40 focus:outline-none"
          >
            <option value="all">All Time</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keyword across actor, action name, description, or IP..."
            className="flex-1 bg-[#0B0F12] border border-[#1B262E] rounded px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500/40 focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-[#1B262E] hover:bg-[#24333E] text-slate-200 text-xs rounded border border-[#2A3B47]"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Events Table */}
      <div className="bg-[#11181C] border border-[#1B262E] rounded-xl overflow-hidden">
        {loading && (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">
            Querying audit trail records...
          </div>
        )}

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="p-12 text-center text-slate-500 font-mono text-sm">
            No audit records found matching the active filters.
          </div>
        )}

        {!loading && events.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0B0F12] border-b border-[#1B262E] text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Actor</th>
                    <th className="p-3.5">Action</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Workspace</th>
                    <th className="p-3.5">Outcome</th>
                    <th className="p-3.5 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B262E]">
                  {events.map((ev) => {
                    const isExpanded = expandedEventId === ev.id;
                    return (
                      <React.Fragment key={ev.id}>
                        <tr
                          onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                          className="hover:bg-[#162026] cursor-pointer transition-colors"
                        >
                          <td className="p-3.5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                            {new Date(ev.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{ev.actor_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {ev.actor_role ? `Role: ${ev.actor_role}` : 'System'}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <div className="font-semibold text-slate-200">{ev.action}</div>
                            <div className="text-[10px] text-slate-500 font-mono truncate max-w-xs">
                              {ev.description}
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0B0F12] border border-[#1B262E] text-slate-300">
                              {ev.category}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-300">
                            {ev.workspace_id || <span className="text-slate-600 font-sans italic">Global</span>}
                          </td>
                          <td className="p-3.5">
                            {ev.outcome === 'SUCCESS' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                SUCCESS
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                FAILURE
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right font-mono text-slate-400 text-[11px]">
                            {isExpanded ? '▲ Less' : '▼ More'}
                          </td>
                        </tr>

                        {/* Expanded Audit Log Metadata */}
                        {isExpanded && (
                          <tr className="bg-[#0B0F12]">
                            <td colSpan={7} className="p-4 space-y-2 border-b border-[#1B262E]">
                              <div className="text-xs font-mono text-slate-300 font-semibold">
                                Event Payload & Context Details (Audit ID #{ev.id})
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-slate-400">
                                <div><span className="text-slate-500">Resource:</span> {ev.resource_type || '—'} {ev.resource_id ? `(#${ev.resource_id})` : ''}</div>
                                <div><span className="text-slate-500">IP Address:</span> {ev.ip_address || 'Internal / Direct'}</div>
                                <div><span className="text-slate-500">Actor Email:</span> {ev.actor_email || '—'}</div>
                              </div>
                              {ev.error_reason && (
                                <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-rose-400 text-xs">
                                  Failure Reason: {ev.error_reason}
                                </div>
                              )}
                              {(ev.old_value || ev.new_value) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                                  {ev.old_value && (
                                    <div>
                                      <span className="text-[10px] font-mono text-slate-500 uppercase">Pre-State</span>
                                      <pre className="p-2 bg-[#11181C] rounded text-[10px] text-slate-300 overflow-x-auto">
                                        {JSON.stringify(ev.old_value, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {ev.new_value && (
                                    <div>
                                      <span className="text-[10px] font-mono text-slate-500 uppercase">Post-State</span>
                                      <pre className="p-2 bg-[#11181C] rounded text-[10px] text-amber-300/90 overflow-x-auto">
                                        {JSON.stringify(ev.new_value, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-3.5 bg-[#0B0F12] border-t border-[#1B262E] flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>Showing {events.length} of {total} records</span>
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
          </>
        )}
      </div>
    </div>
  );
};


export default AdminAuditView;
