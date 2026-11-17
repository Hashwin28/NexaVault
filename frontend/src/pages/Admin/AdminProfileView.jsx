import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const AdminProfileView = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold font-sans text-slate-100">Administrator Profile</h2>
        <p className="text-xs text-slate-400 mt-1">
          Institutional identity and operational credentials for departmental governance.
        </p>
      </div>

      <div className="bg-[#11181C] border border-[#1B262E] rounded-xl p-6 space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 border-b border-[#1B262E] pb-6">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 font-bold text-xl font-mono">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">{user?.full_name || 'Administrator'}</h3>
            <div className="text-xs text-slate-400 font-mono">{user?.email}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Role: Administrator
              </span>
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Account Active
              </span>
            </div>
          </div>
        </div>

        {/* Operational Authority Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
          <div className="p-3 bg-[#0B0F12] rounded-lg border border-[#1B262E]">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Assigned Department</span>
            <div className="font-semibold text-slate-200 mt-1">
              {user?.department ? `Department of ${user.department}` : 'Global / Multi-Department Scope'}
            </div>
          </div>

          <div className="p-3 bg-[#0B0F12] rounded-lg border border-[#1B262E]">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Governance Jurisdiction</span>
            <div className="font-semibold text-slate-200 mt-1">
              Workspaces, Faculty Assignments, Account Standing & Audit Logs
            </div>
          </div>
        </div>

        {/* Institutional Charter & RBAC Notice */}
        <div className="p-4 bg-[#0B0F12] border border-[#1B262E] rounded-lg space-y-2 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-mono text-[11px] font-semibold uppercase">
            <span>🛡</span> Institutional Role Separation Charter
          </div>
          <p className="text-slate-400 leading-relaxed">
            The Administrator role maintains operational oversight, workspace configuration governance, staff assignments, and departmental audit visibility. Under university governance standards, Administrators do not hold academic grading authority. Student marks, evaluation rubrics, and examination score publication remain exclusively with designated Faculty mentors.
          </p>
        </div>
      </div>
    </div>
  );
};
