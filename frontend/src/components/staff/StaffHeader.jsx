import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../ui/ThemeToggle';

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
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#11181C]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1B262E] px-6 py-4 flex items-center justify-between transition-colors select-none shadow-xs">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-[#81939E] dark:hover:text-[#ECF1F4] lg:hidden rounded-lg hover:bg-slate-100 dark:hover:bg-[#0B0F12] border border-slate-200 dark:border-[#1B262E] cursor-pointer"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-[#ECF1F4] tracking-tight font-serif">
            {titleMap[activeTab] || 'Staff Portal'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-[#81939E] font-sans">
            NexaVault Oversight Control Center
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-[#0B0F12] border border-slate-200 dark:border-[#1B262E] text-xs font-sans text-slate-800 dark:text-[#ECF1F4]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-teal-700 dark:text-teal-400 font-bold">STAFF</span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="truncate max-w-[180px] font-medium">{user?.full_name || user?.email}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
};
