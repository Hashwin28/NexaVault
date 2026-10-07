import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const StaffHeader = ({ activeTab, onOpenSidebar }) => {
  const { user } = useAuth();

  const titleMap = {
    dashboard: 'Staff Overview & Dashboard',
    workspaces: 'Managed Workspaces',
    'review-queue': 'Submission Review Queue',
    search: 'Smart Search Engine',
    audit: 'Workspace Audit Logs',
    profile: 'Staff Profile & Security',
    'project-detail': 'Project Oversight & Evaluation',
  };

  return (
    <header className="sticky top-0 z-30 bg-[#080C0E]/90 backdrop-blur-md border-b border-[#1B262E] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="p-2 text-slate-400 hover:text-slate-200 lg:hidden rounded-lg hover:bg-[#11181C]"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight font-serif">
            {titleMap[activeTab] || 'Staff Portal'}
          </h1>
          <p className="text-xs text-slate-400 font-sans">
            NexaVault Oversight Control Center
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#11181C] border border-[#1B262E] text-xs font-sans text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-teal-400 font-semibold">STAFF</span>
          <span className="text-slate-600">|</span>
          <span className="truncate max-w-[180px]">{user?.full_name || user?.email}</span>
        </div>
      </div>
    </header>
  );
};
