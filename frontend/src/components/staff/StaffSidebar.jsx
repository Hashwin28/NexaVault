import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { NexaLogo } from '../layout/NexaLogo';
import { 
  LayoutDashboard, 
  Layers, 
  Users, 
  FolderGit2, 
  CheckSquare, 
  Award, 
  Search, 
  FileText, 
  User, 
  LogOut,
  X 
} from 'lucide-react';

export const StaffSidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workspaces', label: 'Workspaces', icon: Layers },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'projects', label: 'Projects', icon: FolderGit2 },
    { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
    { id: 'results', label: 'Results & Marks', icon: Award },
    { id: 'search', label: 'Smart Search', icon: Search },
    { id: 'audit', label: 'Audit Trail', icon: FileText },
  ];

  const handleItemClick = (id) => {
    setActiveTab(id);
    if (setIsOpen) setIsOpen(false);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0B0F12] border-r border-[#1B262E] flex flex-col justify-between transition-transform duration-200 select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className="p-5 border-b border-[#1B262E] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <NexaLogo size="sm" />
            <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 uppercase tracking-wider">
              Staff
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Menu
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#11181C] border border-transparent'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-teal-400' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Footer & Logout */}
        <div className="p-3 border-t border-[#1B262E] bg-[#0E1317] space-y-2">
          <button
            onClick={() => handleItemClick('profile')}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded bg-[#11181C] border transition-colors text-left ${
              activeTab === 'profile'
                ? 'border-teal-500/40 text-teal-300'
                : 'border-[#1B262E] text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="w-7 h-7 rounded bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-semibold text-xs">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{user?.full_name || 'Staff User'}</div>
              <div className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</div>
            </div>
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-400 bg-rose-950/20 border border-rose-900/30 hover:bg-rose-950/40 rounded transition-colors"
          >
            <LogOut size={12} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default StaffSidebar;
