import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Users, 
  FolderGit2, 
  UploadCloud, 
  CheckCircle2, 
  Search, 
  History, 
  User, 
  LogOut,
  X
} from 'lucide-react';
import { NexaLogo } from '../layout/NexaLogo';
import { useAuth } from '../../context/AuthContext';

export const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workspaces', label: 'Workspaces', icon: Layers },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'submissions', label: 'Submissions & Updates', icon: UploadCloud },
    { id: 'results', label: 'Results', icon: CheckCircle2 },
    { id: 'search', label: 'Smart Search', icon: Search },
  ];

  const systemItems = [
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-vault-surface border-r border-vault-border
        flex flex-col justify-between transition-transform duration-300 ease-in-out select-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between border-b border-vault-border">
          <NexaLogo size="md" />
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-vault-muted hover:text-vault-heading p-1 rounded-md"
            aria-label="Close navigation"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          
          {/* Main Navigation */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-xs font-sans font-semibold tracking-wider text-vault-muted uppercase">
              NexaVault
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 outline-none cursor-pointer
                    ${isActive 
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30 shadow-sm font-semibold' 
                      : 'text-vault-muted hover:text-vault-heading hover:bg-vault-canvas border border-transparent'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={isActive ? 'text-teal-600 dark:text-teal-400' : 'text-vault-muted'} />
                    <span className="font-sans">{item.label}</span>
                  </div>
                </a>
              );
            })}
          </div>

          {/* System Section */}
          <div className="space-y-1">
            <div className="px-3 pb-2 text-xs font-sans font-semibold tracking-wider text-vault-muted uppercase">
              SYSTEM
            </div>
            {systemItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 outline-none cursor-pointer
                    ${isActive 
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30 font-semibold' 
                      : 'text-vault-muted hover:text-vault-heading hover:bg-vault-canvas border border-transparent'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={isActive ? 'text-teal-600 dark:text-teal-400' : 'text-vault-muted'} />
                    <span className="font-sans">{item.label}</span>
                  </div>
                </a>
              );
            })}
          </div>

        </div>

        {/* Profile & Sign Out Footer */}
        <div className="p-4 border-t border-vault-border bg-vault-canvas/60 space-y-3">
          {/* Student Profile Card */}
          <div className="flex items-center gap-3 p-2 rounded-xl bg-vault-surface border border-vault-border shadow-sm">
            <div className="w-9 h-9 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-700 dark:text-teal-300 text-xs font-bold font-sans">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-vault-heading truncate font-sans">{user?.full_name || 'Student'}</h4>
              <p className="text-[10px] text-vault-muted font-sans truncate">{user?.email}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href="#profile"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('profile');
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-[11px] font-medium transition-colors font-sans cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-teal-500/20 text-teal-600 dark:text-teal-300 border-teal-500/40 font-semibold'
                  : 'bg-vault-surface hover:bg-vault-elevated border-vault-border text-vault-muted hover:text-vault-heading'
              }`}
            >
              <User size={14} />
              <span>Profile</span>
            </a>

            <button
              onClick={logout}
              className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-medium transition-colors font-sans cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

      </aside>
    </>
  );
};
