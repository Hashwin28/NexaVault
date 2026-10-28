import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const StaffProfileView = () => {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Header */}
      <div className="bg-gradient-to-r from-teal-950/40 via-[#11181C] to-[#11181C] p-6 rounded-xl border border-teal-500/20 flex justify-between items-center">
        <div>
          <span className="text-xs font-sans text-teal-400 font-bold uppercase">
            Staff Security Profile
          </span>
          <h2 className="text-xl font-bold text-slate-100 mt-1 font-sans">
            {user?.full_name || 'Staff Member'}
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            {user?.email}
          </p>
        </div>
        <span className="px-3 py-1 rounded bg-teal-500/20 text-teal-300 font-sans text-xs font-bold border border-teal-500/30 uppercase">
          Role: {user?.role || 'staff'}
        </span>
      </div>

      {/* Account Details */}
      <div className="bg-[#11181C] p-6 rounded-xl border border-[#1B262E] space-y-4">
        <h3 className="text-sm font-bold text-slate-200 font-sans">Account Credentials & Metadata</h3>

        <div className="space-y-3 font-sans text-xs">
          <div className="flex justify-between p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
            <span className="text-slate-400">Full Name:</span>
            <span className="text-slate-200 font-semibold">{user?.full_name || 'Not provided'}</span>
          </div>

          <div className="flex justify-between p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
            <span className="text-slate-400">Email Address:</span>
            <span className="text-slate-200 font-semibold">{user?.email}</span>
          </div>

          <div className="flex justify-between p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
            <span className="text-slate-400">System Role:</span>
            <span className="text-teal-400 font-bold uppercase">{user?.role || 'staff'}</span>
          </div>

          <div className="flex justify-between p-3 bg-[#0B0F12] rounded border border-[#1B262E]">
            <span className="text-slate-400">User ID:</span>
            <span className="text-slate-400 font-mono">#{user?.id}</span>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-teal-500/5 border border-teal-500/10 text-xs text-slate-400 space-y-1 font-sans">
          <span className="text-teal-400 font-bold block">🔒 Staff Account Security Policy</span>
          <p>
            Public self-registration is strictly restricted to Students. Staff accounts are provisioned centrally and authenticated via secure JWT bearer tokens with PostgreSQL authorization checks.
          </p>
        </div>

        <div className="pt-4 border-t border-[#1B262E] flex justify-end">
          <button
            onClick={logout}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-sans rounded-lg shadow transition-all"
          >
            Sign Out of NexaVault
          </button>
        </div>
      </div>
    </div>
  );
};
