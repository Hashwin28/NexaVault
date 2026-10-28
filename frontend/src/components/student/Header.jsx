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
    <header className="sticky top-0 z-30 w-full bg-vault-surface/90 backdrop-blur-md border-b border-vault-border/60 px-6 py-4 flex items-center justify-between select-none">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg bg-vault-canvas border border-vault-border"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              {title}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-950/80 border border-teal-500/30 text-xs font-sans font-semibold text-teal-400">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              STUDENT
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 hidden sm:block font-sans">
            NexaVault Platform • Academic Vault & Deliverable Lifecycle Core
          </p>
        </div>
      </div>

      {/* Right: Status Badges */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-sans font-medium text-teal-400 bg-teal-950/50 px-3 py-1.5 rounded-lg border border-teal-500/20">
          <ShieldCheck size={14} />
          <span>PostgreSQL API Live</span>
        </div>
      </div>
    </header>
  );
};
