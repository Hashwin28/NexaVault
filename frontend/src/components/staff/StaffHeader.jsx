import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const StaffHeader = ({ activeTab, onOpenSidebar }) => {
  const { user } = useAuth();

  const titleMap = {
    dashboard: 'Staff Overview & Dashboard',
    workspaces: 'Managed Workspaces',
    groups: 'Project Groups',
    projects: 'Project Repository',
    'review-queue': 'Submission Review Queue',
    results: 'Results & Marks',
    search: 'Smart Search Engine',
    audit: 'Workspace Audit Logs',
    profile: 'Staff Profile & Security',
    'project-detail': 'Project Oversight & Evaluation',
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0B0F12] border-b border-[#1B262E] px-6 py-3.5 flex items-center justify-between select-none">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="p-1.5 text-slate-400 hover:text-slate-200 lg:hidden rounded bg-[#11181C] border border-[#1B262E]"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div>
          <h1 className="text-lg font-semibold text-slate-100 tracking-tight font-sans">
            {titleMap[activeTab] || 'Staff Portal'}
          </h1>
          <p className="text-[11px] text-slate-400">
            NexaVault Academic Management Platform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-[#11181C] border border-[#1B262E] text-xs text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="text-teal-400 font-medium">STAFF</span>
          <span className="text-slate-600">|</span>
          <span className="truncate max-w-[180px]">{user?.full_name || user?.email}</span>
        </div>
      </div>
    </header>
  );
};

export default StaffHeader;
