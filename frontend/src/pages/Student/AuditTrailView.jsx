import React from 'react';
import { History, ShieldCheck, Lock, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const AuditTrailView = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
          System Audit Trail
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-sans">
          Immutable event ledger recording group code rotations, membership modifications, and deliverable submissions.
        </p>
      </div>

      {/* Security Status Card */}
      <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 sm:p-7 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white font-display">Cryptographic Audit Logging Active</h2>
            <p className="text-xs text-slate-400">PostgreSQL immutable transaction stream</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60">
            <span className="text-[10px] font-mono uppercase text-slate-500">Student Identity</span>
            <div className="text-sm font-bold text-white mt-1 truncate">{user?.email}</div>
            <div className="text-[11px] font-mono text-teal-400 mt-0.5">UID #{user?.id || '---'}</div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60">
            <span className="text-[10px] font-mono uppercase text-slate-500">Ledger Status</span>
            <div className="text-sm font-bold text-teal-300 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Recording In Backend
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">Hash-Chained Events</div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60">
            <span className="text-[10px] font-mono uppercase text-slate-500">Log Policy</span>
            <div className="text-sm font-bold text-white mt-1">Append-Only</div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">Tamper Evident</div>
          </div>
        </div>
      </div>

      {/* Clean Unexposed State (No Mock Data) */}
      <div className="bg-vault-surface border border-vault-border/60 rounded-2xl p-8 text-center space-y-4 max-w-3xl">
        <div className="w-12 h-12 rounded-2xl bg-vault-canvas border border-vault-border flex items-center justify-center text-slate-400 mx-auto">
          <Lock size={22} />
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-white font-display">
            Student Audit Stream Inspector Unavailable
          </h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto font-sans leading-relaxed">
            All group and deliverable operations are logged directly into the PostgreSQL audit ledger by backend services. The student-facing self-inspection API endpoint is pending Phase 8 deployment. Per NexaVault specifications, no simulated entries are rendered.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-vault-canvas border border-vault-border text-[11px] font-mono text-slate-500">
          <Activity size={12} className="text-teal-400" />
          Backend Audit Engine: Active • Student Viewer: Scheduled Phase 8
        </div>
      </div>
    </div>
  );
};
