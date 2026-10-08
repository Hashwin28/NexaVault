import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { auditApi } from '../../api/auditApi';

export const AuditTrailView = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditApi.getAuditLogs();
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-tight">
            System Audit Trail
          </h1>
          <p className="text-sm text-slate-400 mt-1 font-sans">
            Immutable event ledger recording group updates, deliverable submissions, evaluations, and results.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-vault-surface border border-vault-border/60 hover:border-teal-500/40 text-slate-200 text-xs rounded-xl font-sans transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Security Status Card */}
      <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-serif">Cryptographic Audit Logging Active</h2>
            <p className="text-xs text-slate-400 font-sans">PostgreSQL append-only ledger</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60">
            <span className="text-[10px] font-sans uppercase text-slate-500">Student Identity</span>
            <div className="text-sm font-bold text-white mt-1 truncate font-sans">{user?.email}</div>
            <div className="text-[11px] font-mono text-teal-400 mt-0.5">UID #{user?.id || '---'}</div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60">
            <span className="text-[10px] font-sans uppercase text-slate-500">Ledger Stream</span>
            <div className="text-sm font-bold text-teal-300 mt-1 flex items-center gap-1.5 font-sans">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Verified Active
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">{logs.length} Recorded Events</div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60">
            <span className="text-[10px] font-sans uppercase text-slate-500">Integrity Policy</span>
            <div className="text-sm font-bold text-white mt-1 font-sans">Append-Only</div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">Tamper Evident</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2 font-sans">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Audit Log Stream */}
      <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2 font-serif">
          <History size={18} className="text-teal-400" /> Recent Activity Stream
        </h3>

        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-slate-500 flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span>Fetching cryptographic audit stream...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-xs font-sans text-slate-500">
            No audit records found in your scoped event history.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 bg-vault-canvas border border-vault-border/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      {log.action_type}
                    </span>
                    <span className="font-semibold text-slate-200 font-sans">{log.entity_type}</span>
                    {log.entity_id && (
                      <span className="text-slate-500 font-mono text-[11px]">#{log.entity_id}</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs font-sans">
                    Action by: <span className="text-slate-200">{log.actor_name || 'System'}</span>
                  </div>
                </div>

                <div className="text-right sm:text-right font-mono text-[11px] text-slate-500 shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
