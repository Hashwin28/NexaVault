import React from 'react';
import { User, Mail, Shield, CheckCircle2, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const ProfileView = () => {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-8 select-none max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans tracking-tight">
          Student Profile
        </h1>
        <p className="text-sm text-slate-400 mt-1 font-sans">
          Manage your NexaVault account identity, enrollment credentials, and session state.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-vault-surface border border-teal-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-card-subtle">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-vault-border/50 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 text-2xl font-bold font-sans shadow-md">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white font-sans">
              {user?.full_name || 'Registered Student'}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 font-sans">
                <Mail size={13} className="text-teal-400" />
                {user?.email}
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 font-sans text-[10px] uppercase font-bold">
                Role: {user?.role || 'student'}
              </span>
            </div>
          </div>
        </div>

        {/* Identity Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60 space-y-1">
            <span className="text-slate-500 uppercase text-[10px]">Student Identifier</span>
            <div className="text-white font-bold text-sm font-mono">UID #{user?.id || '---'}</div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60 space-y-1">
            <span className="text-slate-500 uppercase text-[10px]">System Access Tier</span>
            <div className="text-teal-300 font-bold text-sm flex items-center gap-1.5">
              <Shield size={14} />
              Authenticated Student
            </div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60 space-y-1">
            <span className="text-slate-500 uppercase text-[10px]">Session Status</span>
            <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Active JWT Bearer Session
            </div>
          </div>

          <div className="p-4 rounded-xl bg-vault-canvas border border-vault-border/60 space-y-1">
            <span className="text-slate-500 uppercase text-[10px]">Authentication Policy</span>
            <div className="text-white font-bold text-sm">
              Role-Enforced Server-Side
            </div>
          </div>
        </div>

        {/* Security & Sign Out Section */}
        <div className="pt-4 border-t border-vault-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 font-sans">
            Need to switch accounts or end your session on this terminal?
          </p>

          <button
            onClick={logout}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold font-sans flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut size={15} />
            <span>Terminate Session (Sign Out)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
