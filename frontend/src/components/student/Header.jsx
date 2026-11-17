import React from 'react';
import { Menu, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Header = ({ onOpenSidebar, activeTab }) => {
  const { user } = useAuth();

  const tabTitles = {
    dashboard: 'Student Dashboard',
    workspaces: 'Workspaces',
    groups: 'Group Vault',
    projects: 'Projects',
    submissions: 'Submissions & Updates',
    results: 'Results & Evaluation',
    search: 'Smart Search',
    profile: 'Student Profile',
  };

  const title = tabTitles[activeTab] || 'Student Portal';

  return (
    <header className="sticky top-0 z-30 w-full bg-[#0B0F12] border-b border-[#1B262E] px-6 py-3.5 flex items-center justify-between select-none">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded bg-[#11181C] border border-[#1B262E]"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight text-white font-sans">
              {title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-[10px] font-semibold text-teal-400 uppercase">
              Student
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            NexaVault Academic Management Platform
          </p>
        </div>
      </div>

      {/* Right: Status Badges */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-[#11181C] border border-[#1B262E] text-xs text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span className="text-teal-400 font-medium">STUDENT</span>
          <span className="text-slate-600">|</span>
          <span className="truncate max-w-[180px]">{user?.full_name || user?.email}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
