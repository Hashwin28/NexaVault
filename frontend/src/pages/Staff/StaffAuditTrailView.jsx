import React, { useState, useEffect } from 'react';
import { auditApi } from '../../api/auditApi';
import { workspaceApi } from '../../api/workspaceApi';

export const StaffAuditTrailView = () => {
  const [logs, setLogs] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWsId, setSelectedWsId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    fetchAuditLogs(selectedWsId || null);
  }, [selectedWsId]);

  const fetchWorkspaces = async () => {
    try {
      const data = await workspaceApi.getMyWorkspaces();
      setWorkspaces(data || []);
    } catch (err) {
      console.error('Failed to fetch workspaces for audit filter:', err);
    }
  };

  const fetchAuditLogs = async (wsId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditApi.getAuditLogs(wsId);
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load audit trail logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1B262E] pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 font-serif flex items-center gap-2">
            Append-Only Audit Trail
            <span className="text-xs px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-sans font-normal">
              Immutable Log
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Audit history tracking staff administrative actions, score corrections, access approvals, and evaluation updates.
          </p>
        </div>

        {/* Workspace Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-sans text-slate-400 uppercase">Filter Workspace:</label>
          <select
            value={selectedWsId}
            onChange={(e) => setSelectedWsId(e.target.value)}
            className="bg-[#11181C] border border-[#1B262E] rounded px-3 py-1.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-teal-500"
          >
            <option value="">All Managed Workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.id} - {ws.name || ws.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm font-sans">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-[#11181C] rounded-xl border border-[#1B262E] overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs font-sans text-slate-500">
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-xs font-sans text-slate-500 border border-dashed border-[#1B262E] m-4 rounded-lg">
            No audit events recorded for the selected workspace scope.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 font-sans">
              <thead className="bg-[#0B0F12] text-slate-400 font-sans text-[11px] uppercase border-b border-[#1B262E]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Workspace</th>
                  <th className="py-3 px-4">Audit Details / Justification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B262E]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#162026] transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at || log.timestamp || Date.now()).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-teal-300">
                      {log.action || log.event_type}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200">
                      {log.actor_email || log.user_email || `User #${log.actor_id || log.user_id}`}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {log.workspace_id ? `#${log.workspace_id}` : 'Global'}
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">
                      {log.details || log.reason || JSON.stringify(log.meta || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
