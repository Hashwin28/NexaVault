import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Users, 
  FolderGit2, 
  UploadCloud, 
  CheckCircle2, 
  Search, 
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
    { id: 'submissions', label: 'Submissions', icon: UploadCloud },
    { id: 'results', label: 'Results', icon: CheckCircle2 },
    { id: 'search', label: 'Smart Search', icon: Search },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0B0F12] border-r border-[#1B262E]
        flex flex-col justify-between transition-transform duration-200 select-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-[#1B262E]">
          <div className="flex items-center gap-2">
            <NexaLogo size="sm" />
            <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-wider">
              Student
            </span>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Menu
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
                  w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors outline-none cursor-pointer
                  ${isActive 
                    ? 'bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#11181C] border border-transparent'}
                `}
              >
                <Icon size={15} className={isActive ? 'text-teal-400' : 'text-slate-400'} />
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>

        {/* Profile & Sign Out Footer */}
        <div className="p-3 border-t border-[#1B262E] bg-[#0E1317] space-y-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded bg-[#11181C] border border-[#1B262E]">
            <div className="w-7 h-7 rounded bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 text-xs font-semibold">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.full_name || 'Student Account'}
              </p>
              <p className="text-[10px] text-slate-500 truncate font-mono">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab('profile');
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-slate-300 bg-[#11181C] border border-[#1B262E] hover:border-slate-600 transition-colors"
            >
              <User size={12} className="text-slate-400" />
              <span>Profile</span>
            </button>
            <button
              onClick={logout}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-rose-400 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-950/40 transition-colors"
              title="Sign Out"
            >
              <LogOut size={12} />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
