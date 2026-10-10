import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { NexaLogo } from '../layout/NexaLogo';
import { 
  LayoutDashboard, 
  Layers, 
  CheckCircle2, 
  Search, 
  History, 
  User, 
  LogOut,
  X 
} from 'lucide-react';

export const StaffSidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const { logout, user } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'workspaces', label: 'Workspaces', icon: Layers },
    { id: 'review-queue', label: 'Review Queue', icon: CheckCircle2 },
    { id: 'search', label: 'Smart Search', icon: Search },
    { id: 'audit', label: 'Audit Trail', icon: History },
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white dark:bg-[#11181C] border-r border-slate-200 dark:border-[#1B262E] flex flex-col justify-between transition-transform duration-300 ease-in-out select-none shadow-sm ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className="p-6 border-b border-slate-200 dark:border-[#1B262E] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <NexaLogo size="md" />
            <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/30 uppercase">
              Staff
            </span>
          </div>
          <div className="text-xs font-sans text-slate-500 dark:text-[#81939E] flex items-center gap-1.5">
            <span className="truncate">{user?.full_name || user?.email}</span>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          <div className="px-3 pb-2 text-xs font-sans font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Supervision
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-[#81939E] hover:text-slate-900 dark:hover:text-[#ECF1F4] hover:bg-slate-100 dark:hover:bg-[#0B0F12]'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-[#81939E]'} />
                <span className="font-sans">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* System & Account Section */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1B262E] bg-slate-50 dark:bg-[#0B0F12] space-y-3">
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleItemClick('profile')}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-[11px] font-medium transition-colors font-sans cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-teal-100/60 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-semibold'
                  : 'bg-white dark:bg-[#11181C] hover:bg-slate-100 dark:hover:bg-[#162026] border-slate-200 dark:border-[#1B262E] text-slate-600 dark:text-[#81939E] hover:text-slate-900 dark:hover:text-[#ECF1F4]'
              }`}
            >
              <User size={14} />
              <span>Profile</span>
            </button>

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
